import React from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import SalesWeeklyUpdateForm from "@/components/kpis/SalesWeeklyUpdateForm";
import SimpleTargetsButtons from "@/components/kpis/SimpleTargetsButtons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Info } from "lucide-react";

export default function SalesUpdatePage() {
  return (
    <PageLayout title="Actualización de Ventas">
      <div className="max-w-screen-xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-1">Actualización Mensual de Ventas</h1>
        <p className="text-gray-600 mb-6">
          Registra o actualiza las ventas mensuales de cualquier período.
        </p>

        {/* Sección de objetivos simplificada */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-medium">Objetivos de Ventas</h2>
          </div>
          <SimpleTargetsButtons />
        </div>

        {/* Layout de dos columnas para formulario e instrucciones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulario de actualización semanal - Ahora ocupa 2/3 del espacio en desktop */}
          <Card className="shadow-md bg-white border dark:bg-slate-900 dark:border-slate-800 md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-medium">Formulario de Actualización</CardTitle>
                  <CardDescription>Ingresa las ventas de la semana actual</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SalesWeeklyUpdateForm />
            </CardContent>
          </Card>

          {/* Tarjeta de instrucciones - Más compacta y simple */}
          <Card className="shadow-md bg-slate-50 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                <CardTitle className="text-lg font-medium">Instrucciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2 items-start">
                  <div className="bg-slate-200 text-slate-700 rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5 dark:bg-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-xs">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Selecciona la compañía</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Dura International (KG) o Grupo Orsega (Unidades)
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-start">
                  <div className="bg-slate-200 text-slate-700 rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5 dark:bg-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-xs">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Ingresa los valores</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Valor de ventas según la unidad de la compañía
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-start">
                  <div className="bg-slate-200 text-slate-700 rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5 dark:bg-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-xs">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium">El sistema actualiza:</h3>
                    <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc ml-4 space-y-1">
                      <li>Guarda el registro semanal</li>
                      <li>Calcula el acumulado mensual</li>
                      <li>Actualiza el KPI y su cumplimiento</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}