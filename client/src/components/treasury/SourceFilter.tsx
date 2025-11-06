import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export type SourceOption = 'monex' | 'santander' | 'dof';

interface SourceFilterProps {
  selectedSources: SourceOption[];
  onChange: (sources: SourceOption[]) => void;
  className?: string;
}

const SOURCE_CONFIG = {
  monex: {
    label: 'MONEX',
    color: '#2563eb', // azul
  },
  santander: {
    label: 'Santander',
    color: '#16a34a', // verde
  },
  dof: {
    label: 'DOF',
    color: '#ea580c', // naranja
  },
} as const;

export function SourceFilter({ 
  selectedSources, 
  onChange,
  className 
}: SourceFilterProps) {
  const allSources: SourceOption[] = ['monex', 'santander', 'dof'];

  const handleSourceToggle = (source: SourceOption) => {
    if (selectedSources.includes(source)) {
      // Remover fuente
      onChange(selectedSources.filter(s => s !== source));
    } else {
      // Agregar fuente
      onChange([...selectedSources, source]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSources.length === allSources.length) {
      // Deseleccionar todas
      onChange([]);
    } else {
      // Seleccionar todas
      onChange([...allSources]);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Fuentes</Label>
            <button
              onClick={handleSelectAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {selectedSources.length === allSources.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </button>
          </div>
          <div className="space-y-2">
            {allSources.map((source) => {
              const config = SOURCE_CONFIG[source];
              const isSelected = selectedSources.includes(source);
              
              return (
                <div key={source} className="flex items-center space-x-2">
                  <Checkbox
                    id={`source-${source}`}
                    checked={isSelected}
                    onCheckedChange={() => handleSourceToggle(source)}
                  />
                  <Label
                    htmlFor={`source-${source}`}
                    className="text-sm font-normal cursor-pointer flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    {config.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

