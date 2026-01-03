import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbPage,
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  objectIcon?: LucideIcon | ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    icon?: LucideIcon;
    primary?: boolean;
  }>;
  compactDetails?: Array<{
    label: string;
    value: string | ReactNode;
  }>;
  className?: string;
}

export function PageHeader({
  objectIcon: Icon,
  breadcrumbs,
  title,
  subtitle,
  actions = [],
  compactDetails,
  className
}: PageHeaderProps) {
  const primaryAction = actions.find(a => a.primary) || actions[0];
  const secondaryActions = actions.filter(a => !a.primary && a !== primaryAction);

  return (
    <div className={cn("space-y-4 pb-4 border-b", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={item.href || '#'}>
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Object Icon */}
          {Icon && (
            <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
              {typeof Icon === 'function' ? (
                <Icon className="h-6 w-6 text-primary" />
              ) : (
                Icon
              )}
            </div>
          )}

          {/* Title and Subtitle */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}

            {/* Compact Details */}
            {compactDetails && compactDetails.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-3">
                {compactDetails.map((detail, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {detail.label}:
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {secondaryActions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={action.onClick}
                >
                  {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
                  {action.label}
                </Button>
              );
            })}
            {primaryAction && (() => {
              const PrimaryIcon = primaryAction.icon;
              return (
                <Button
                  variant={primaryAction.variant || 'default'}
                  size="sm"
                  onClick={primaryAction.onClick}
                >
                  {PrimaryIcon && <PrimaryIcon className="h-4 w-4 mr-2" />}
                  {primaryAction.label}
                </Button>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

