import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md'
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      icon: 'h-8 w-8',
      title: 'text-base',
      description: 'text-sm',
      padding: 'py-8'
    },
    md: {
      icon: 'h-12 w-12',
      title: 'text-lg',
      description: 'text-base',
      padding: 'py-12'
    },
    lg: {
      icon: 'h-16 w-16',
      title: 'text-xl',
      description: 'text-lg',
      padding: 'py-16'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      classes.padding,
      className
    )}>
      {Icon && (
        <div className={cn(
          "mb-4 text-muted-foreground",
          classes.icon
        )}>
          {typeof Icon === 'function' ? (
            <Icon className={classes.icon} />
          ) : (
            Icon
          )}
        </div>
      )}
      
      <h3 className={cn(
        "font-semibold text-foreground mb-2",
        classes.title
      )}>
        {title}
      </h3>
      
      <p className={cn(
        "text-muted-foreground max-w-md mb-6",
        classes.description
      )}>
        {description}
      </p>
      
      {action && (
        <Button
          onClick={action.onClick}
          variant="default"
          size={size === 'sm' ? 'sm' : 'default'}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

