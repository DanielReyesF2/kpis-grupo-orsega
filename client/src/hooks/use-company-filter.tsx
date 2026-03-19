import { useState, useEffect, createContext, useContext } from 'react';

type CompanyFilterContextType = {
  selectedCompany: number;
  setSelectedCompany: (companyId: number) => void;
};

const CompanyFilterContext = createContext<CompanyFilterContextType | null>(null);

export function CompanyFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 1;
  });

  // Guardar la selección en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('selectedCompanyId', selectedCompany.toString());
  }, [selectedCompany]);

  // Sincronizar con el evento companyChanged del Sidebar
  useEffect(() => {
    const handleCompanyChange = (event: CustomEvent) => {
      const { companyId } = event.detail;
      if (typeof companyId === 'number' && (companyId === 1 || companyId === 2)) {
        setSelectedCompany(companyId);
      }
    };
    window.addEventListener('companyChanged', handleCompanyChange as EventListener);
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChange as EventListener);
    };
  }, []);

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