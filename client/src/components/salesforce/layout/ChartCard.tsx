import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Download, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onViewReport?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  className?: string;
  headerActions?: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  children,
  onViewReport,
  onRefresh,
  onExport,
  isLoading = false,
  className,
  headerActions
}: ChartCardProps) {
  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {subtitle && (
            <CardDescription className="text-xs mt-1">
              {subtitle}
            </CardDescription>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerActions}
          
          {(onViewReport || onRefresh || onExport) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onViewReport && (
                  <DropdownMenuItem onClick={onViewReport}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver reporte
                  </DropdownMenuItem>
                )}
                {onRefresh && (
                  <DropdownMenuItem onClick={onRefresh} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                    Actualizar
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar datos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        {children}
      </CardContent>
    </Card>
  );
}

