import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  variant?: 'table' | 'card' | 'chart' | 'form' | 'list';
  className?: string;
  rows?: number;
  columns?: number;
}

export function LoadingState({ 
  variant = 'card', 
  className,
  rows = 3,
  columns = 3
}: LoadingStateProps) {
  if (variant === 'table') {
    return (
      <div className={cn("space-y-2", className)}>
        {/* Header skeleton */}
        <div className="flex gap-4 pb-2 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-6 flex-1" />
          ))}
        </div>
        {/* Rows skeleton */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="flex gap-4 justify-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// Specific skeleton components for convenience
export function TableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return <LoadingState variant="table" rows={rows} columns={columns} className={className} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return <LoadingState variant="card" className={className} />;
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <LoadingState variant="chart" className={className} />;
}

export function FormSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return <LoadingState variant="form" rows={rows} className={className} />;
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return <LoadingState variant="list" rows={rows} className={className} />;
}

