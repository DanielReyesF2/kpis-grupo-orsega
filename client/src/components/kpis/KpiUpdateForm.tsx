import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Calendar, Target } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const kpiUpdateSchema = z.object({
  kpiId: z.number().min(1, "Debe seleccionar un KPI"),
  value: z.string().min(1, "El valor es requerido"),
  period: z.string().min(1, "El período es requerido"),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof kpiUpdateSchema>;

interface KpiUpdateFormProps {
  companyId: number;
}

export default function KpiUpdateForm({ companyId }: KpiUpdateFormProps) {
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(kpiUpdateSchema),
    defaultValues: {
      kpiId: 0,
      value: "",
      period: "",
      comments: "",
    },
  });

  // Obtener KPIs filtrados por empresa y área del usuario
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["/api/kpis", companyId],
    queryFn: async () => {
      const response = await fetch(`/api/kpis?companyId=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) throw new Error('Error al obtener KPIs');
      return response.json();
    },
  });

  // Mutación para crear nuevo valor de KPI
  const mutation = useMutation({
    mutationFn: async (formValues: FormValues) => {
      const response = await fetch('/api/kpi-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          kpiId: formValues.kpiId,
          value: formValues.value,
          period: formValues.period,
          comments: formValues.comments || "",
          date: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar KPI');
      }

      return await response.json();
    },
    onSuccess: () => {
      setSubmissionStatus("success");
      toast({
        title: "KPI actualizado",
        description: "El valor del KPI ha sido registrado exitosamente.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-values"] });
    },
    onError: (error: Error) => {
      setSubmissionStatus("error");
      toast({
        title: "Error al actualizar KPI",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    setSubmissionStatus("idle");
    mutation.mutate(data);
  };

  if (kpisLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Cargando KPIs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!kpis || kpis.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No hay KPIs disponibles para tu área en esta empresa.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md bg-white border dark:bg-slate-900 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg font-medium">Actualizar KPI</CardTitle>
        </div>
        <CardDescription>
          Registra un nuevo valor para los KPIs de tu área
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="kpiId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    KPI a actualizar
                  </FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un KPI" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kpis.map((kpi: any) => (
                        <SelectItem key={kpi.id} value={kpi.id.toString()}>
                          {kpi.name}
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
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: 95.5%, 1500 KG, 2.3 días"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Período
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Enero 2025, Q1 2025, Semana 1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentarios (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observaciones sobre este valor..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? "Actualizando..." : "Actualizar KPI"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}