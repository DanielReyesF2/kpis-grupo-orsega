import { isValidElement } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "@/types/lucide";

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
          {(() => {
            try {
              // If it's already a rendered React element, return it
              if (isValidElement(Icon)) {
                return Icon;
              }
              // Check if it's a React component (function or forwardRef with $$typeof)
              if (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon)) {
                const IconComponent = Icon as LucideIcon;
                return <IconComponent className={classes.icon} />;
              }
              return null;
            } catch (error) {
              console.error('Error rendering icon:', error);
              return null;
            }
          })()}
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

