import { devLog } from "@/lib/logger";
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface CompanySelectorProps {
  companies: { id: number; name: string }[];
  selectedCompanyId: number;
  onCompanyChange: (companyId: number) => void;
}

export function CompanySelector({ companies, selectedCompanyId, onCompanyChange }: CompanySelectorProps) {
  // Manejar el cambio de empresa
  const handleChange = (value: string) => {
    const newCompanyId = Number(value);
    devLog.log('CompanySelector: Cambiando a compañía ID:', newCompanyId);
    // Forzar el cambio de compañía incluso si es la misma (para actualizar el componente)
    onCompanyChange(newCompanyId);
  };

  return (
    <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-lg shadow-md border border-white/30 p-2 hover:bg-white/30 transition-colors">
      <div className="px-3">
        <Building2 className="h-6 w-6 text-white" />
      </div>
      <Select
        defaultValue={selectedCompanyId.toString()}
        value={selectedCompanyId.toString()}
        onValueChange={handleChange}
      >
        <SelectTrigger className="border-0 bg-transparent focus:ring-0 focus:ring-offset-0 p-2 text-white font-medium">
          <SelectValue placeholder="Seleccionar empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id.toString()}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}