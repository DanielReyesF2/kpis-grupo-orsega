/**
 * Month/Year Selector - Selector de período para el dashboard
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface MonthYearSelectorProps {
  companyId: number;
  selectedYear: number;
  selectedMonth: number;
  onChange: (year: number, month: number) => void;
}

export function MonthYearSelector({
  companyId,
  selectedYear,
  selectedMonth,
  onChange,
}: MonthYearSelectorProps) {
  const { data: availableYears } = useQuery<number[]>({
    queryKey: ['/api/annual-summary/years', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/annual-summary/years?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId && companyId > 0,
  });

  const years = availableYears || [new Date().getFullYear()];
  const canGoBack = years.includes(selectedYear - 1) || years.some(y => y < selectedYear);
  const canGoForward = selectedYear < new Date().getFullYear() ||
    (selectedYear === new Date().getFullYear() && selectedMonth < new Date().getMonth() + 1);

  const handlePrevYear = () => {
    if (canGoBack) onChange(selectedYear - 1, selectedMonth);
  };

  const handleNextYear = () => {
    const nextYear = selectedYear + 1;
    const currentYear = new Date().getFullYear();
    if (nextYear <= currentYear) {
      onChange(nextYear, selectedMonth);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span className="text-sm font-medium">Período</span>
      </div>

      {/* Year navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevYear}
          disabled={!canGoBack}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Badge variant="secondary" className="text-sm font-semibold px-3">
          {selectedYear}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextYear}
          disabled={!canGoForward}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Month pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {MONTH_LABELS.map((label, idx) => {
          const monthNum = idx + 1;
          const isSelected = monthNum === selectedMonth;
          const isFuture = selectedYear === new Date().getFullYear() && monthNum > new Date().getMonth() + 1;

          return (
            <Button
              key={monthNum}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2.5 text-xs font-medium ${
                isSelected ? "" : "text-muted-foreground hover:text-foreground"
              }`}
              disabled={isFuture}
              onClick={() => onChange(selectedYear, monthNum)}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
