import { Button } from "@/components/ui/button";

interface CompanySelectorProps {
  selectedCompanyId: number | null;
  onSelect: (companyId: number) => void;
}

export function CompanySelector({ selectedCompanyId, onSelect }: CompanySelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-foreground mb-4">
        Selecciona la empresa que está pagando
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grupo Orsega */}
        <Button
          onClick={() => onSelect(2)}
          size="lg"
          variant={selectedCompanyId === 2 ? "default" : "outline"}
          className={`h-32 text-lg font-semibold flex flex-col items-center justify-center gap-3 ${
            selectedCompanyId === 2
              ? "bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700"
              : "border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          } transition-all shadow-md`}
        >
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <img 
              src="/logo orsega.jpg" 
              alt="Grupo Orsega Logo" 
              className="h-12 w-auto object-contain"
              style={{ maxWidth: '120px' }}
              onError={(e) => {
                // Fallback si la imagen no carga
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="text-blue-600 text-xl font-bold">ORSEGA</div>';
                }
              }}
            />
          </div>
          <span>GRUPO ORSEGA</span>
        </Button>
        
        {/* Dura International */}
        <Button
          onClick={() => onSelect(1)}
          size="lg"
          variant={selectedCompanyId === 1 ? "default" : "outline"}
          className={`h-32 text-lg font-semibold flex flex-col items-center justify-center gap-3 ${
            selectedCompanyId === 1
              ? "bg-green-600 hover:bg-green-700 text-white border-2 border-green-700"
              : "border-2 hover:bg-green-50 dark:hover:bg-green-950/20"
          } transition-all shadow-md`}
        >
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <img 
              src="/logodura.jpg" 
              alt="Dura International Logo" 
              className="h-12 w-auto object-contain"
              style={{ maxWidth: '120px' }}
              onError={(e) => {
                // Fallback si la imagen no carga
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="text-green-600 text-xl font-bold">DURA</div>';
                }
              }}
            />
          </div>
          <span>DURA INTERNATIONAL</span>
        </Button>
      </div>
    </div>
  );
}

