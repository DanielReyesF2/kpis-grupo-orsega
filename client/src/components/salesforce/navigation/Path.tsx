import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface PathStage {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  description?: string;
}

export interface PathProps {
  stages: PathStage[];
  currentStage: string;
  onStageClick?: (stageId: string) => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export function Path({
  stages,
  currentStage,
  onStageClick,
  variant = 'default',
  className
}: PathProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn("flex items-center", className)}>
      {stages.map((stage, index) => {
        const isCompleted = stage.status === 'completed';
        const isCurrent = stage.status === 'current' || stage.id === currentStage;
        const isUpcoming = stage.status === 'upcoming' && !isCurrent;
        const isClickable = onStageClick && (isCompleted || isCurrent);

        return (
          <div key={stage.id} className="flex items-center">
            {/* Stage */}
            <div
              className={cn(
                "flex items-center",
                isClickable && "cursor-pointer",
                !isCompact && "flex-col"
              )}
              onClick={() => isClickable && onStageClick?.(stage.id)}
            >
              {/* Circle */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-all",
                  isCompact ? "h-8 w-8" : "h-10 w-10",
                  isCompleted && "bg-primary border-primary text-white",
                  isCurrent && "bg-primary/10 border-primary text-primary",
                  isUpcoming && "bg-muted border-muted-foreground/30 text-muted-foreground",
                  isClickable && "hover:scale-110"
                )}
              >
                {isCompleted ? (
                  <Check className={cn(isCompact ? "h-4 w-4" : "h-5 w-5")} />
                ) : (
                  <span className={cn(
                    "font-semibold",
                    isCompact ? "text-xs" : "text-sm"
                  )}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              {!isCompact && (
                <div className={cn(
                  "mt-2 text-center max-w-[120px]",
                  isCurrent && "font-semibold"
                )}>
                  <p className={cn(
                    "text-sm",
                    isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {stage.label}
                  </p>
                  {stage.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stage.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Connector */}
            {index < stages.length - 1 && (
              <div className={cn(
                "flex items-center mx-2",
                isCompact ? "w-12" : "w-16"
              )}>
                <div className={cn(
                  "h-0.5 flex-1",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                )} />
                {!isCompact && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

