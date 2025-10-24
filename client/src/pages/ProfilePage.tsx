import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  Target, 
  TrendingUp, 
  BookOpen, 
  CheckCircle, 
  Clock,
  ArrowRight,
  Building,
  Users,
  ArrowLeft
} from "lucide-react";
import { JobProfileWithDetails } from "@shared/schema";
import { Link } from "wouter";

export default function ProfilePage() {
  const { user } = useAuth();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: [`/api/job-profiles/${user?.id}`],
    enabled: !!user?.id,
    retry: false, // No reintentar en 404 - es normal que no exista el perfil
  });

  const { data: userKpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: [`/api/user-kpis/${user?.id}`],
    enabled: !!user?.id,
  });

  // Solo mostrar loading si ambas queries están cargando Y no hemos determinado que profile no existe
  const shouldShowLoading = (isLoading && !error) || isLoadingKpis;

  if (shouldShowLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Botón de navegación de regreso */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
        </div>
        
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil de Usuario
            </CardTitle>
            <CardDescription>
              Tu perfil personalizado no está disponible aún. Pronto tendrás acceso a información detallada sobre tu puesto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Building className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">
                Estamos configurando tu perfil personalizado con información específica de tu puesto.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileData = profile as JobProfileWithDetails;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Botón de navegación de regreso */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>
      </div>
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{user?.name}</h1>
            <p className="text-gray-600">{profileData.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{profileData.companyName}</Badge>
              <Badge variant="outline">{profileData.areaName}</Badge>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="kpis">Mis KPIs</TabsTrigger>
          <TabsTrigger value="activities">Actividades</TabsTrigger>
          <TabsTrigger value="tips">Tips & Guías</TabsTrigger>
        </TabsList>

        {/* Vista General */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Descripción del Puesto */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Descripción del Puesto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {profileData.description}
                </p>
              </CardContent>
            </Card>

            {/* Resumen de KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Resumen de KPIs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total de KPIs</span>
                    <Badge variant="secondary">{profileData.userKpis.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Semanales</span>
                    <span className="text-sm font-medium">
                      {profileData.userKpis.filter(k => k.frequency === 'weekly').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Mensuales</span>
                    <span className="text-sm font-medium">
                      {profileData.userKpis.filter(k => k.frequency === 'monthly').length}
                    </span>
                  </div>
                  <Separator />
                  <Link href="/kpi-control">
                    <Button className="w-full">
                      Actualizar KPIs
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Responsabilidades Principales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Responsabilidades Principales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profileData.responsibilities.map((responsibility, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <span className="text-sm text-gray-700">{responsibility}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mis KPIs */}
        <TabsContent value="kpis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Mis KPIs Asignados
              </CardTitle>
              <CardDescription>
                Estos son los KPIs que debes monitorear y actualizar regularmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profileData.userKpis.map((kpi, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{kpi.name}</h3>
                        <p className="text-sm text-gray-600">Objetivo: {kpi.target}</p>
                      </div>
                      <Badge variant={kpi.frequency === 'weekly' ? 'default' : 'secondary'}>
                        {kpi.frequency === 'weekly' ? 'Semanal' : 'Mensual'}
                      </Badge>
                    </div>
                    
                    {/* Instrucciones específicas para este KPI */}
                    {profileData.kpiInstructions.find(inst => inst.kpiName === kpi.name) && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Instrucciones:</strong> {profileData.kpiInstructions.find(inst => inst.kpiName === kpi.name)?.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>¿Dónde actualizar?</strong> Ve a la sección 
                  <Link href="/kpi-control" className="mx-1 font-medium underline">
                    "Centro de Control de KPIs"
                  </Link>
                  para actualizar todos tus KPIs.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actividades */}
        <TabsContent value="activities" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actividades Principales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Actividades Principales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {profileData.mainActivities.map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="bg-blue-100 p-1 rounded-full">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                        <span className="text-sm text-gray-700">{activity}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Frecuencia de Actualización */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Cronograma de Actividades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Diarias</h4>
                    <ul className="space-y-1">
                      {profileData.updateFrequency.daily.map((item, index) => (
                        <li key={index} className="text-sm text-gray-600 pl-4 border-l-2 border-green-200">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Semanales</h4>
                    <ul className="space-y-1">
                      {profileData.updateFrequency.weekly.map((item, index) => (
                        <li key={index} className="text-sm text-gray-600 pl-4 border-l-2 border-blue-200">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Mensuales</h4>
                    <ul className="space-y-1">
                      {profileData.updateFrequency.monthly.map((item, index) => (
                        <li key={index} className="text-sm text-gray-600 pl-4 border-l-2 border-purple-200">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tips & Guías */}
        <TabsContent value="tips" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tips para el Éxito */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tips para el Éxito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {profileData.tips.map((tip, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{tip.category}</h4>
                        <p className="text-sm text-gray-700">{tip.tip}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Procesos y Procedimientos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Procesos y Procedimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {profileData.processes.map((process, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{process.name}</h4>
                        <p className="text-sm text-gray-600 mb-3">{process.description}</p>
                        <div className="space-y-2">
                          {process.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex items-start gap-2">
                              <Badge variant="outline" className="text-xs">
                                {stepIndex + 1}
                              </Badge>
                              <span className="text-sm text-gray-700">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}