import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Building2, Calendar, DollarSign, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Schema simplificado - solo lo esencial
const salesFormSchema = z.object({
  value: z.string().min(1, "El valor es requerido"),
  companyId: z.number().min(1, "La empresa es requerida"),
  month: z.string().min(1, "El mes es requerido"),
  year: z.number().min(2020, "El año es requerido")
});

type FormValues = z.infer<typeof salesFormSchema>;

interface SalesWeeklyUpdateFormProps {
  showHeader?: boolean;
}

export default function SalesWeeklyUpdateForm({ showHeader = true }: SalesWeeklyUpdateFormProps = {}) {
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1);
  const { toast } = useToast();

  // Obtener mes y año actuales
  const today = new Date();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const currentMonth = monthNames[today.getMonth()];
  const currentYear = today.getFullYear();

  const form = useForm<FormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      value: "",
      companyId: 1,
      month: currentMonth,
      year: currentYear
    }
  });

  // Consulta para obtener las compañías
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: true,
  });

  // Efecto para actualizar el ID de la empresa seleccionada
  useEffect(() => {
    const companyIdValue = form.watch("companyId");
    setSelectedCompanyId(companyIdValue);
  }, [form.watch("companyId")]);

  // Determinar la unidad según la empresa seleccionada
  const getUnitLabel = () => {
    return selectedCompanyId === 1 ? "Valor en KG" : "Valor en unidades";
  };

  const getUnitPlaceholder = () => {
    return selectedCompanyId === 1 ? "Ej: 55000" : "Ej: 850000";
  };

  // Datos para selectores
  const months = monthNames;
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Mutación simplificada
  const mutation = useMutation({
    mutationFn: async (formValues: FormValues) => {
      console.log("[SalesUpdate] Enviando actualización:", formValues);
      
      // Convertir el valor a número
      const valueAsString = String(formValues.value || '');
      const numericValue = parseFloat(valueAsString.replace(/[^0-9.]/g, ''));
      
      // Construir el período en formato "Mes Año"
      const period = `${formValues.month} ${formValues.year}`;
      
      const requestBody = {
        value: numericValue,
        companyId: formValues.companyId,
        period: period,
        month: formValues.month,
        year: formValues.year
      };
      
      console.log('[SalesUpdate] Enviando:', requestBody);
      
      // Usar apiRequest que ya maneja el token correctamente
      const response = await apiRequest('POST', '/api/sales/update-month', requestBody);
      return await response.json();
    },
    onSuccess: async (response) => {
      setSubmissionStatus("success");
      setSubmissionMessage(response.message || "Ventas actualizadas correctamente");
      toast({
        title: "✅ Actualización exitosa",
        description: response.message || "Las ventas han sido registradas correctamente.",
      });
      
      // Invalidar y refrescar consultas inmediatamente
      const kpiId = selectedCompanyId === 1 ? 39 : 10;
      
      // Invalidar todas las consultas relacionadas
      await queryClient.invalidateQueries({ queryKey: ["/api/kpi-values"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/kpis"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/kpi-history/${kpiId}`] });
      
      // Forzar refetch inmediato para actualizar el dashboard
      await queryClient.refetchQueries({ queryKey: [`/api/kpi-history/${kpiId}`] });
      
      // Limpiar solo el campo de valor
      form.setValue("value", "");
    },
    onError: (error: any) => {
      setSubmissionStatus("error");
      setSubmissionMessage(
        error?.message || "Error al actualizar los datos de ventas"
      );
      toast({
        title: "❌ Error en la actualización",
        description: error?.message || "Error al actualizar los datos de ventas",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    setSubmissionStatus("idle");
    mutation.mutate(data);
  };

  return (
    <div className={showHeader ? "max-w-lg mx-auto" : "w-full"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200 text-sm mb-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Compañía
                </FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(parseInt(value));
                    setSelectedCompanyId(parseInt(value));
                  }}
                  defaultValue={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 text-base border-2 hover:border-blue-400 transition-colors bg-white dark:bg-slate-800">
                      <SelectValue placeholder="Selecciona una compañía" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {companies.map((company: any) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Selectores de Mes y Año */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200 text-sm mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    Mes
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12 text-base border-2 hover:border-blue-400 transition-colors bg-white dark:bg-slate-800">
                        <SelectValue placeholder="Mes" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200 text-sm mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    Año
                  </FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12 text-base border-2 hover:border-blue-400 transition-colors bg-white dark:bg-slate-800">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Campo de valor destacado */}
          <div className="relative">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-center gap-2 font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg">{getUnitLabel()}</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder={getUnitPlaceholder()}
                        type="text"
                        className="h-16 text-2xl text-center font-bold border-3 border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900/30 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 transition-all duration-200"
                        onChange={(e) => {
                          // Permitir solo números
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          // Formatear con separador de miles
                          const formattedValue = value ? parseInt(value).toLocaleString('es-MX') : '';
                          field.onChange(formattedValue);
                        }}
                      />
                      <div className="absolute -top-2 -right-2">
                        <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
                      </div>
                    </div>
                  </FormControl>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                    Ingresa el valor total del mes seleccionado
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {submissionStatus === "success" && (
            <Alert variant="default" className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 dark:bg-green-900/30 dark:border-green-700 animate-in slide-in-from-top-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-300 text-base font-semibold">¡Actualización completada!</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-400">
                {submissionMessage}
              </AlertDescription>
            </Alert>
          )}

          {submissionStatus === "error" && (
            <Alert variant="destructive" className="animate-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="text-base font-semibold">Error</AlertTitle>
              <AlertDescription>{submissionMessage}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit"
            className="w-full h-16 text-lg font-bold bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl group relative overflow-hidden"
            disabled={mutation.isPending}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 group-hover:animate-pulse" />
                  <span>Actualizar {form.watch('month')} {form.watch('year')}</span>
                </>
              )}
            </span>
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </Button>
        </form>
      </Form>
    </div>
  );
}
