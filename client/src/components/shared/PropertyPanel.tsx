import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Property {
  label: string;
  value: ReactNode;
  editable?: boolean;
  onEdit?: () => void;
}

interface PropertyPanelProps {
  title?: string;
  properties: Property[];
  className?: string;
}

export function PropertyPanel({
  title,
  properties,
  className = "",
}: PropertyPanelProps) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {properties.map((property, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {property.label}
              </label>
              {property.editable && property.onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={property.onEdit}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 min-h-[32px]">
              {typeof property.value === "string" ? (
                <span className="text-sm text-slate-900 dark:text-slate-50">
                  {property.value}
                </span>
              ) : (
                property.value
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

