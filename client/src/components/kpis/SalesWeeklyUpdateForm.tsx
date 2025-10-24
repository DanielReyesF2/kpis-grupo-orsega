import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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

export default function SalesWeeklyUpdateForm() {
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
    <div className="max-w-md mx-auto space-y-6">
      {/* Encabezado */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Actualizar Ventas Mensuales</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Selecciona el mes y registra las ventas totales
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-gray-700 dark:text-gray-300">Compañía</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(parseInt(value));
                    setSelectedCompanyId(parseInt(value));
                  }}
                  defaultValue={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 text-base">
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
                  <FormLabel className="font-medium text-gray-700 dark:text-gray-300">Mes</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12">
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
                  <FormLabel className="font-medium text-gray-700 dark:text-gray-300">Año</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12">
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

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-gray-700 dark:text-gray-300 text-lg">
                  {getUnitLabel()}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={getUnitPlaceholder()}
                    type="text"
                    className="h-14 text-xl text-center font-semibold border-2 focus:border-blue-500"
                    onChange={(e) => {
                      // Permitir solo números
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      // Formatear con separador de miles
                      const formattedValue = value ? parseInt(value).toLocaleString('es-MX') : '';
                      field.onChange(formattedValue);
                    }}
                  />
                </FormControl>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Ingresa el valor total del mes
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {submissionStatus === "success" && (
            <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-300 text-base">Actualización completada</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-400">
                {submissionMessage}
              </AlertDescription>
            </Alert>
          )}

          {submissionStatus === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="text-base">Error</AlertTitle>
              <AlertDescription>{submissionMessage}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit"
            className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Actualizando...
              </>
            ) : (
              `Actualizar ${form.watch('month')} ${form.watch('year')}`
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
