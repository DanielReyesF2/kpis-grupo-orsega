import { useState, useCallback, useRef } from "react";
import { FileText, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ImportDropZoneProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function ImportDropZone({ onFileSelected, isProcessing }: ImportDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({
          title: "Archivo no soportado",
          description: "Solo PDF, Excel (.xlsx) o imágenes (PNG, JPG, WebP)",
          variant: "destructive",
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Archivo demasiado grande",
          description: "El tamaño máximo es 20MB",
          variant: "destructive",
        });
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      // Reset input
      e.target.value = "";
    }
  };

  if (isProcessing) {
    return (
      <div className="border-2 border-dashed border-purple-300 bg-purple-50 rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-purple-700">Leyendo orden de compra...</p>
        <p className="text-xs text-purple-500">Extrayendo datos con AI</p>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileInput}
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
          isDragOver
            ? "border-purple-500 bg-purple-50 scale-[1.02] shadow-lg"
            : "border-slate-300 bg-slate-50/50 hover:border-purple-400 hover:bg-purple-50/50"
        )}
      >
        {isDragOver ? (
          <>
            <Sparkles className="h-8 w-8 text-purple-500" />
            <p className="text-sm font-semibold text-purple-700">
              Suelta para crear importación
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-slate-400" />
              <Upload className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                Arrastra tu Orden de Compra aquí
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PDF, Excel, o imagen (o haz click para seleccionar)
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
