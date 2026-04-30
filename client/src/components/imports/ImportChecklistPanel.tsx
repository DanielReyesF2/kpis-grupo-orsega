import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Check,
  Upload,
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ChecklistItem {
  id: number;
  import_order_id: number;
  stage: string;
  label: string;
  type: string;
  is_required: boolean;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: number | null;
  file_key: string | null;
  file_name: string | null;
}

interface ImportChecklistPanelProps {
  orderId: number;
  currentStatus: string;
  checklist: ChecklistItem[];
}

const STAGE_LABELS: Record<string, string> = {
  oc_created: "OC Creada",
  in_transit_to_customs: "Camino a Aduana",
  in_customs: "En Aduana",
  in_yard: "En Patio",
  in_transit_to_warehouse: "Camino a Bodega",
  in_warehouse: "En Bodega",
};

const STAGE_ORDER = [
  "oc_created",
  "in_transit_to_customs",
  "in_customs",
  "in_yard",
  "in_transit_to_warehouse",
  "in_warehouse",
];

export function ImportChecklistPanel({ orderId, currentStatus, checklist }: ImportChecklistPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Group by stage
  const byStage = STAGE_ORDER.map((stage) => {
    const items = checklist.filter((c) => c.stage === stage);
    const requiredItems = items.filter((c) => c.is_required);
    const completedRequired = requiredItems.filter((c) => c.is_completed).length;
    const total = requiredItems.length;
    const currentIdx = STAGE_ORDER.indexOf(currentStatus);
    const stageIdx = STAGE_ORDER.indexOf(stage);
    const isPast = stageIdx < currentIdx;
    const isCurrent = stage === currentStatus;
    const isFuture = stageIdx > currentIdx;

    return { stage, items, completedRequired, total, isPast, isCurrent, isFuture };
  });

  return (
    <div className="space-y-2">
      {byStage.map(({ stage, items, completedRequired, total, isPast, isCurrent, isFuture }) => {
        if (items.length === 0) return null;

        const isAllDone = total > 0 && completedRequired >= total;
        const defaultOpen = isCurrent;

        return (
          <Collapsible key={stage} defaultOpen={defaultOpen}>
            <CollapsibleTrigger className="w-full">
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all",
                  isCurrent && "bg-purple-50 text-purple-800 border border-purple-200",
                  isPast && isAllDone && "bg-emerald-50 text-emerald-700",
                  isPast && !isAllDone && "bg-slate-50 text-slate-600",
                  isFuture && "bg-slate-50 text-slate-400"
                )}
              >
                <div className="flex items-center gap-2">
                  {isPast && isAllDone ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : isCurrent ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>{STAGE_LABELS[stage]}</span>
                  {isAllDone && <span className="text-xs">✓</span>}
                </div>
                <span className="text-xs">
                  ({completedRequired}/{total})
                </span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-4 pr-2 py-2 space-y-2">
                {items.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    orderId={orderId}
                    disabled={isFuture}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function ChecklistItemRow({
  item,
  orderId,
  disabled,
}: {
  item: ChecklistItem;
  orderId: number;
  disabled: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleMutation = useMutation({
    mutationFn: async (isCompleted: boolean) => {
      const res = await apiRequest("PATCH", `/api/import-orders/${orderId}/checklist/${item.id}`, { isCompleted });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/import-orders/${orderId}`] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload("POST", `/api/import-orders/${orderId}/checklist/${item.id}/upload`, formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/import-orders/${orderId}`] });
      toast({ title: "Archivo subido" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo subir el archivo", variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  };

  const isFileType = item.type === "file";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-2 py-1.5 rounded-md",
        item.is_completed ? "bg-emerald-50/50" : "hover:bg-slate-50"
      )}
    >
      {/* Checkbox or file indicator */}
      {isFileType ? (
        item.is_completed ? (
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-emerald-500" />
          </div>
        ) : (
          <FileText className="h-4 w-4 text-slate-300" />
        )
      ) : (
        <button
          onClick={() => !disabled && toggleMutation.mutate(!item.is_completed)}
          disabled={disabled || toggleMutation.isPending}
          className={cn(
            "h-4 w-4 rounded border flex items-center justify-center transition-all",
            item.is_completed
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-300 hover:border-purple-400",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {item.is_completed && <Check className="h-3 w-3" />}
        </button>
      )}

      {/* Label */}
      <span
        className={cn(
          "text-sm flex-1",
          item.is_completed ? "text-slate-500 line-through" : "text-slate-700",
          !item.is_required && "italic"
        )}
      >
        {item.label}
        {!item.is_required && <span className="text-xs text-slate-400 ml-1">(opcional)</span>}
      </span>

      {/* File actions */}
      {isFileType && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          {item.is_completed && item.file_name ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 max-w-[100px] truncate">
                {item.file_name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => window.open(`/api/files/url/${encodeURIComponent(item.file_key || "")}`, "_blank")}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploadMutation.isPending}
            >
              <Upload className="h-3 w-3 mr-1" />
              {uploadMutation.isPending ? "Subiendo..." : "Subir"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
