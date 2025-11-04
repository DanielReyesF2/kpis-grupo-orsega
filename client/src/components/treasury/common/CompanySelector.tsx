import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

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
        <Button
          onClick={() => onSelect(2)}
          size="lg"
          variant={selectedCompanyId === 2 ? "default" : "outline"}
          className={`h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2 ${
            selectedCompanyId === 2
              ? "bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700"
              : "border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          } transition-all shadow-md`}
        >
          <Building2 className="h-8 w-8" />
          <span>GRUPO ORSEGA</span>
        </Button>
        <Button
          onClick={() => onSelect(1)}
          size="lg"
          variant={selectedCompanyId === 1 ? "default" : "outline"}
          className={`h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2 ${
            selectedCompanyId === 1
              ? "bg-green-600 hover:bg-green-700 text-white border-2 border-green-700"
              : "border-2 hover:bg-green-50 dark:hover:bg-green-950/20"
          } transition-all shadow-md`}
        >
          <Building2 className="h-8 w-8" />
          <span>DURA INTERNATIONAL</span>
        </Button>
      </div>
    </div>
  );
}

