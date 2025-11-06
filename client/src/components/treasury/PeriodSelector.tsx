import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

export type PeriodOption = '1w' | '1m' | '3m' | '6m' | '1y' | 'custom';

interface PeriodSelectorProps {
  value: PeriodOption;
  onChange: (period: PeriodOption) => void;
  onCustomRangeChange?: (startDate: Date, endDate: Date) => void;
  className?: string;
}

export function PeriodSelector({ 
  value, 
  onChange, 
  onCustomRangeChange,
  className 
}: PeriodSelectorProps) {
  const periodOptions = [
    { value: '1w', label: '1 semana' },
    { value: '1m', label: '1 mes' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '1y', label: '1 año' },
    { value: 'custom', label: 'Rango personalizado' },
  ] as const;

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(val) => onChange(val as PeriodOption)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Seleccionar periodo" />
        </SelectTrigger>
        <SelectContent>
          {periodOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === 'custom' && onCustomRangeChange && (
        <CustomDateRangePicker onRangeChange={onCustomRangeChange} />
      )}
    </div>
  );
}

// Componente auxiliar para rango personalizado (implementación básica)
function CustomDateRangePicker({ 
  onRangeChange 
}: { 
  onRangeChange: (startDate: Date, endDate: Date) => void 
}) {
  // Implementación básica - se puede mejorar con un date picker
  const handleChange = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    onRangeChange(thirtyDaysAgo, today);
  };

  return (
    <button
      onClick={handleChange}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      Seleccionar fechas
    </button>
  );
}

