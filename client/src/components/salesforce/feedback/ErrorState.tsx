import { AlertCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  variant?: 'inline' | 'card' | 'page' | 'toast';
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  severity?: 'error' | 'warning' | 'info';
}

export function ErrorState({
  variant = 'card',
  title,
  message,
  onRetry,
  onDismiss,
  className,
  severity = 'error'
}: ErrorStateProps) {
  const severityConfig = {
    error: {
      icon: XCircle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20',
      textColor: 'text-destructive'
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
      textColor: 'text-warning-foreground'
    },
    info: {
      icon: Info,
      iconColor: 'text-info',
      bgColor: 'bg-info/10',
      borderColor: 'border-info/20',
      textColor: 'text-info-foreground'
    }
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  if (variant === 'inline') {
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm",
        config.textColor,
        className
      )}>
        <Icon className={cn("h-4 w-4", config.iconColor)} />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn(
        config.bgColor,
        config.borderColor,
        "border",
        className
      )}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconColor)} />
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className={cn("font-semibold mb-1", config.textColor)}>
                  {title}
                </h3>
              )}
              <p className={cn("text-sm", config.textColor)}>
                {message}
              </p>
              {(onRetry || onDismiss) && (
                <div className="flex gap-2 mt-4">
                  {onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                    >
                      Reintentar
                    </Button>
                  )}
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDismiss}
                    >
                      Cerrar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'page') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center min-h-[400px] text-center p-8",
        className
      )}>
        <Icon className={cn("h-16 w-16 mb-4", config.iconColor)} />
        {title && (
          <h2 className={cn("text-2xl font-semibold mb-2", config.textColor)}>
            {title}
          </h2>
        )}
        <p className={cn("text-lg mb-6 max-w-md", config.textColor)}>
          {message}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  // Toast variant would be handled by toast system
  return null;
}

