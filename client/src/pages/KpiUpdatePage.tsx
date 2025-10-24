import React, { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import KpiUpdateForm from "@/components/kpis/KpiUpdateForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, TrendingUp, Building2, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export default function KpiUpdatePage() {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  
  // Obtener lista de empresas
  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
    enabled: !!user,
  });

  // Recordar la última empresa seleccionada
  useEffect(() => {
    const savedCompanyId = localStorage.getItem('selectedCompanyId');
    if (savedCompanyId && companies) {
      setSelectedCompanyId(parseInt(savedCompanyId));
    } else if (companies && companies.length > 0) {
      // Por defecto, seleccionar la primera empresa
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies]);

  // Guardar la selección de empresa
  const handleCompanyChange = (companyId: string) => {
    const id = parseInt(companyId);
    setSelectedCompanyId(id);
    localStorage.setItem('selectedCompanyId', companyId);
  };

  // Obtener información del área del usuario
  const getAreaName = (areaId: number) => {
    const areaNames = {
      1: "Ventas",
      2: "Logística", 
      3: "Compras",
      4: "Almacén",
      5: "Tesorería"
    };
    return areaNames[areaId] || "Área desconocida";
  };

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  return (
    <PageLayout title="Actualizar KPIs">
      <div className="max-w-screen-xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Actualización de KPIs</h1>
        </div>
        
        {/* Información del usuario */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Información del Usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Usuario:</span> {user?.name}
              </div>
              <div>
                <span className="font-medium">Área:</span> {user?.areaId ? getAreaName(user.areaId) : "Sin área asignada"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selector de empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Seleccionar Empresa
            </CardTitle>
            <CardDescription>
              Elige la empresa para la cual deseas actualizar los KPIs de tu área ({user?.areaId ? getAreaName(user.areaId) : "área"})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCompanyId?.toString()} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar empresa..." />
              </SelectTrigger>
              <SelectContent>
                {companies?.map(company => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Información actual */}
        {selectedCompany && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                <Info className="h-5 w-5" />
                Configuración Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Empresa seleccionada:</span> {selectedCompany.name}
                </div>
                <div>
                  <span className="font-medium">Área a actualizar:</span> {user?.areaId ? getAreaName(user.areaId) : "Sin área"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulario de actualización */}
        {selectedCompanyId && user?.areaId && (
          <Card>
            <CardHeader>
              <CardTitle>KPIs de {getAreaName(user.areaId)} - {selectedCompany?.name}</CardTitle>
              <CardDescription>
                Actualiza los KPIs correspondientes a tu área en la empresa seleccionada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KpiUpdateForm companyId={selectedCompanyId} />
            </CardContent>
          </Card>
        )}

        {/* Mensaje de información si no hay área asignada */}
        {!user?.areaId && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-yellow-800">
                <Info className="h-5 w-5" />
                <span className="font-medium">
                  No tienes un área asignada. Contacta al administrador para que te asigne un área.
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}