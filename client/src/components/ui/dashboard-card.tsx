import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { LucideIcon } from "@/types/lucide";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  description?: string;
  value: string | number;
  icon: LucideIcon;
  onClick: () => void;
  dataOnboarding?: string;
  tone?: "primary" | "success" | "warning" | "neutral";
}

const toneStyles: Record<
  NonNullable<DashboardCardProps["tone"]>,
  {
    accentBar: string;
    iconWrapper: string;
    value: string;
    card: string;
  }
> = {
  primary: {
    accentBar: "bg-primary/70",
    iconWrapper: "bg-primary/15 text-primary",
    value: "text-primary",
    card: "hover:border-primary/40",
  },
  success: {
    accentBar: "bg-success/70",
    iconWrapper: "bg-success/15 text-success",
    value: "text-success",
    card: "hover:border-success/40",
  },
  warning: {
    accentBar: "bg-warning/70",
    iconWrapper: "bg-warning/15 text-warning",
    value: "text-warning",
    card: "hover:border-warning/40",
  },
  neutral: {
    accentBar: "bg-muted/40",
    iconWrapper: "bg-muted/20 text-muted-foreground",
    value: "text-foreground",
    card: "hover:border-border",
  },
};

export function DashboardCard({
  title,
  description,
  value,
  icon: Icon,
  onClick,
  dataOnboarding,
  tone = "primary",
}: DashboardCardProps) {
  const styles = toneStyles[tone] ?? toneStyles.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      data-onboarding={dataOnboarding}
    >
      <Card
        className={cn(
          "cursor-pointer transition-modern border border-border/60 bg-card overflow-hidden",
          "shadow-soft hover:shadow-lg",
          styles.card
        )}
        onClick={onClick}
      >
        <div className={cn("h-1", styles.accentBar)} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg shadow-sm", styles.iconWrapper)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  {title}
                </CardTitle>
                {description && (
                  <CardDescription className="text-sm text-muted-foreground mt-1">
                    {description}
                  </CardDescription>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn("text-3xl font-bold", styles.value)}>
            {value}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
