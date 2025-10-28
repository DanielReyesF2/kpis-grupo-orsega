import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  description?: string;
  value: string | number;
  icon: LucideIcon;
  onClick: () => void;
  gradient?: string;
  dataOnboarding?: string;
}

export function DashboardCard({
  title,
  description,
  value,
  icon: Icon,
  onClick,
  gradient = "from-blue-500 to-indigo-600",
  dataOnboarding,
}: DashboardCardProps) {
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
        className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 shadow-lg overflow-hidden"
        onClick={onClick}
      >
        <div className={`h-2 bg-gradient-to-r ${gradient}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-md`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </CardTitle>
                {description && (
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {description}
                  </CardDescription>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
            {value}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
