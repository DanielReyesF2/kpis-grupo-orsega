import { useState, useEffect, createContext, useContext } from 'react';

type CompanyFilterContextType = {
  selectedCompany: number;
  setSelectedCompany: (companyId: number) => void;
};

const CompanyFilterContext = createContext<CompanyFilterContextType | null>(null);

export function CompanyFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    // Intentar recuperar la compañía seleccionada del localStorage
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 1; // Por defecto, Dura International (ID: 1)
  });

  // Guardar la selección en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('selectedCompanyId', selectedCompany.toString());
  }, [selectedCompany]);

  return (
    <CompanyFilterContext.Provider value={{ selectedCompany, setSelectedCompany }}>
      {children}
    </CompanyFilterContext.Provider>
  );
}

export function useCompanyFilter() {
  const context = useContext(CompanyFilterContext);
  if (!context) {
    throw new Error('useCompanyFilter must be used within a CompanyFilterProvider');
  }
  return context;
}