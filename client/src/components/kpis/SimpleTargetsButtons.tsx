import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Calculator, Target } from "lucide-react";

// Componente para mostrar y editar objetivos de ventas mediante botones simples
export default function SimpleTargetsButtons() {
  const queryClient = useQueryClient();

  // Estados para el diálogo de edición
  const [open, setOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ id: number, name: string, unit: string } | null>(null);
  const [annualTarget, setAnnualTarget] = useState("");
  const [calculatedMonthly, setCalculatedMonthly] = useState("");
  const [calculatedWeekly, setCalculatedWeekly] = useState("");

  // Cargar las empresas y los KPIs
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
  });

  const { data: kpis = [] } = useQuery({
    queryKey: ["/api/kpis"],
  });

  // Estado para almacenar los objetivos cargados
  const [targets, setTargets] = useState<{
    companyId: number;
    annualTarget: number;
    name: string;
    unit: string;
  }[]>([]);

  // Mapeo de companyId a valor de meta anual predeterminado
  const defaultTargets = {
    1: 667449, // Dura International (KG)
    2: 10300476, // Grupo Orsega (unidades)
  };

  // Efecto para cargar objetivos desde localStorage o usar defaults
  useEffect(() => {
    if (companies.length === 0 || kpis.length === 0) return;

    const storedTargets = localStorage.getItem("salesTargets");
    let loadedTargets: Record<string, any> = {};
    
    try {
      if (storedTargets) {
        loadedTargets = JSON.parse(storedTargets);
      }
    } catch (error) {
      console.error("Error al parsear objetivos almacenados:", error);
    }

    // Preparar los objetivos para cada compañía
    const newTargets = companies.map((company: any) => {
      // Obtener el KPI de ventas para esta compañía
      const salesKpi = kpis.find((kpi: any) => 
        kpi.companyId === company.id && 
        kpi.name.toLowerCase().includes("volumen de ventas")
      );

      // Verificar si hay un objetivo almacenado para esta compañía
      const storedTarget = loadedTargets[company.id];
      let annualTarget = defaultTargets[company.id] || 0;

      // Usar el objetivo almacenado si existe, o el KPI target si no
      if (storedTarget && storedTarget.annualTarget) {
        annualTarget = storedTarget.annualTarget;
      } else if (salesKpi && salesKpi.target) {
        // Extraer el objetivo del KPI si está disponible (formato: "X,XXX KG")
        const targetMatch = salesKpi.target.match(/[\d,]+/);
        if (targetMatch) {
          const targetValue = targetMatch[0].replace(/,/g, '');
          // Multiplicar por 12 porque el KPI está en valor mensual
          annualTarget = parseInt(targetValue) * 12;
        }
      }

      const unit = company.id === 1 ? "KG" : "unidades";
      
      return {
        companyId: company.id,
        annualTarget,
        name: company.name,
        unit
      };
    });

    setTargets(newTargets);
  }, [companies, kpis]);

  // Actualizar objetivos en localStorage
  const saveTargets = (companyId: number, newAnnualTarget: number) => {
    try {
      // Obtener los objetivos almacenados actualmente
      const storedTargets = localStorage.getItem("salesTargets") || "{}";
      const targets = JSON.parse(storedTargets);
      
      // Calcular los objetivos mensual y semanal
      const monthlyTarget = Math.round(newAnnualTarget / 12);
      const weeklyTarget = Math.round(monthlyTarget / 4.33);
      
      // Actualizar el objetivo para la compañía específica
      targets[companyId] = {
        annualTarget: newAnnualTarget,
        monthlyTarget,
        weeklyTarget,
        timestamp: new Date().toISOString()
      };
      
      // Guardar en localStorage
      localStorage.setItem("salesTargets", JSON.stringify(targets));
      
      // Actualizar el estado
      setTargets(prevTargets => 
        prevTargets.map(target => 
          target.companyId === companyId 
            ? { ...target, annualTarget: newAnnualTarget } 
            : target
        )
      );
      
      return { monthlyTarget, weeklyTarget };
    } catch (error) {
      console.error("Error al guardar objetivos:", error);
      throw error;
    }
  };

  // Mutación para actualizar un objetivo
  const updateTargetMutation = useMutation({
    mutationFn: async ({ companyId, annualTarget }: { companyId: number, annualTarget: number }) => {
      try {
        // Parsear el valor para asegurar que es un número
        const targetValue = typeof annualTarget === 'string' 
          ? parseInt(annualTarget.replace(/[^\d]/g, '')) 
          : annualTarget;
          
        if (isNaN(targetValue)) {
          throw new Error("El valor del objetivo no es válido");
        }
        
        // Guardar en localStorage
        const result = saveTargets(companyId, targetValue);
        
        // Aquí podrías hacer una llamada a la API si quisieras persistir estos cambios en el servidor
        
        return result;
      } catch (error) {
        console.error("Error actualizando objetivo:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Mostrar notificación de éxito
      toast({
        title: "Objetivo actualizado",
        description: `Se ha actualizado el objetivo anual de ventas para ${selectedCompany?.name}.`,
      });
      
      // Cerrar el diálogo
      setOpen(false);
      
      // Invalidar consultas que puedan depender de este objetivo
      queryClient.invalidateQueries({ queryKey: ["/api/kpis"] });
    },
    onError: (error: Error) => {
      // Mostrar notificación de error
      toast({
        title: "Error",
        description: `No se pudo actualizar el objetivo: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (company: any) => {
    setSelectedCompany(company);
    
    // Formatear el valor para mostrarlo con separador de miles
    const formattedValue = company.annualTarget.toLocaleString('es-MX');
    setAnnualTarget(formattedValue);
    
    // Calcular objetivos mensual y semanal
    const monthlyValue = Math.round(company.annualTarget / 12);
    const weeklyValue = Math.round(monthlyValue / 4.33);
    
    setCalculatedMonthly(monthlyValue.toLocaleString('es-MX'));
    setCalculatedWeekly(weeklyValue.toLocaleString('es-MX'));
    
    setOpen(true);
  };

  const handleAnnualTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir solo números y formatear con separador de miles
    const value = e.target.value.replace(/[^\d]/g, '');
    
    if (value) {
      const numericValue = parseInt(value);
      setAnnualTarget(numericValue.toLocaleString('es-MX'));
      
      // Actualizar los valores calculados
      const monthlyValue = Math.round(numericValue / 12);
      const weeklyValue = Math.round(monthlyValue / 4.33);
      
      setCalculatedMonthly(monthlyValue.toLocaleString('es-MX'));
      setCalculatedWeekly(weeklyValue.toLocaleString('es-MX'));
    } else {
      setAnnualTarget('');
      setCalculatedMonthly('');
      setCalculatedWeekly('');
    }
  };

  const handleSaveTarget = () => {
    if (!selectedCompany) return;
    
    // Convertir valor formateado a número
    const numericValue = parseInt(annualTarget.replace(/[^\d]/g, ''));
    
    if (isNaN(numericValue)) {
      toast({
        title: "Error",
        description: "Por favor ingresa un valor numérico válido",
        variant: "destructive",
      });
      return;
    }
    
    updateTargetMutation.mutate({
      companyId: selectedCompany.id,
      annualTarget: numericValue
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {targets.map((company) => (
        <Button
          key={company.companyId}
          variant="outline"
          onClick={() => handleOpenDialog(company)}
          className="bg-white hover:bg-blue-50 border border-blue-200 text-left flex items-center justify-between h-auto py-3 px-4 rounded-lg shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex flex-col">
            <span className="font-medium text-sm text-gray-900">{company.name}</span>
            <span className="text-xs text-gray-500">Objetivo anual en {company.unit}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            <Target className="h-4 w-4" />
            <span className="font-medium">{company.annualTarget.toLocaleString('es-MX')}</span>
          </div>
        </Button>
      ))}

      {/* Diálogo para editar objetivo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar objetivo de ventas</DialogTitle>
            <DialogDescription>
              Establece el objetivo anual de ventas para {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span>Objetivo anual ({selectedCompany?.unit})</span>
              </label>
              <Input
                type="text"
                value={annualTarget}
                onChange={handleAnnualTargetChange}
                className="text-right font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Calculator className="h-3 w-3" />
                  <span>Meta mensual</span>
                </label>
                <div className="border rounded-md py-2 px-3 bg-slate-50 text-right text-sm">
                  {calculatedMonthly || "-"}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Calculator className="h-3 w-3" />
                  <span>Meta semanal</span>
                </label>
                <div className="border rounded-md py-2 px-3 bg-slate-50 text-right text-sm">
                  {calculatedWeekly || "-"}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveTarget} disabled={updateTargetMutation.isPending}>
              {updateTargetMutation.isPending ? "Guardando..." : "Guardar objetivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}