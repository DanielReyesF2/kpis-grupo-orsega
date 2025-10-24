import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient } from '@/lib/queryClient';
import { createKpi, updateKpi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Form validation schema
const kpiFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  areaId: z.string().min(1, 'El área es requerida'),
  companyId: z.string().min(1, 'La empresa es requerida'),
  unit: z.string().min(1, 'La unidad de medida es requerida'),
  target: z.string().min(1, 'El objetivo es requerido'),
  frequency: z.string().min(1, 'La frecuencia es requerida'),
  calculationMethod: z.string().optional(),
  responsible: z.string().optional(),
});

interface KpiFormProps {
  id?: number;
}

export default function KpiForm({ id }: KpiFormProps) {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const isEditing = !!id;

  // Fetch KPI data if editing
  const { data: kpi, isLoading: isLoadingKpi } = useQuery<any>({
    queryKey: [`/api/kpis/${id}`],
    enabled: isEditing,
  });

  // Fetch companies
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<any[]>({
    queryKey: ['/api/companies'],
  });

  // State for selected company to filter areas
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Fetch areas based on selected company
  const { data: areas, isLoading: isLoadingAreas } = useQuery<any[]>({
    queryKey: ['/api/areas', selectedCompanyId && !isNaN(parseInt(selectedCompanyId)) ? { companyId: parseInt(selectedCompanyId) } : null],
    enabled: !!selectedCompanyId && !isNaN(parseInt(selectedCompanyId)),
  });

  // Setup form with validation
  const form = useForm<z.infer<typeof kpiFormSchema>>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: '',
      description: '',
      areaId: '',
      companyId: '',
      unit: '',
      target: '',
      frequency: '',
      calculationMethod: '',
      responsible: '',
    },
  });

  // Set form values when editing and data is loaded
  useEffect(() => {
    if (isEditing && kpi) {
      form.reset({
        name: kpi.name,
        description: kpi.description || '',
        areaId: kpi.areaId.toString(),
        companyId: kpi.companyId.toString(),
        unit: kpi.unit,
        target: kpi.target,
        frequency: kpi.frequency,
        calculationMethod: kpi.calculationMethod || '',
        responsible: kpi.responsible || '',
      });
      setSelectedCompanyId(kpi.companyId.toString());
    }
  }, [isEditing, kpi, form]);

  // Handle company selection to update areas
  const handleCompanyChange = (value: string) => {
    form.setValue('companyId', value);
    setSelectedCompanyId(value);
    form.setValue('areaId', ''); // Reset area when company changes
  };

  // Create KPI mutation
  const createMutation = useMutation({
    mutationFn: createKpi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({
        title: 'KPI creado',
        description: 'El KPI ha sido creado exitosamente.',
      });
      setLocation('/');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo crear el KPI: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    },
  });

  // Update KPI mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateKpi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({
        title: 'KPI actualizado',
        description: 'El KPI ha sido actualizado exitosamente.',
      });
      setLocation('/');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo actualizar el KPI: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: z.infer<typeof kpiFormSchema>) => {
    const formattedData = {
      ...data,
      areaId: parseInt(data.areaId),
      companyId: parseInt(data.companyId),
    };

    if (isEditing && id) {
      updateMutation.mutate({ id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  // Determine if the form is in a loading state
  const isLoading = isLoadingKpi || isLoadingCompanies || isLoadingAreas || 
                   createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout title={isEditing ? 'Editar KPI' : 'Nuevo KPI'}>
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar KPI' : 'Crear Nuevo KPI'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingKpi && isEditing ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del KPI" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={handleCompanyChange}
                          disabled={isLoadingCompanies}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(companies) && companies.map((company: any) => (
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
                  
                  <FormField
                    control={form.control}
                    name="areaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!selectedCompanyId || isLoadingAreas}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar área" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(areas) && areas.map((area: any) => (
                              <SelectItem key={area.id} value={area.id.toString()}>
                                {area.name}
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
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad de Medida</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: %, días, unidades" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="target"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objetivo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: 100%, < 45 días" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frecuencia de Medición</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar frecuencia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensual</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="responsible"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsable</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del responsable" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="calculationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Cálculo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: (Valor actual / Valor objetivo) x 100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descripción detallada del KPI" 
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation('/')}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Actualizar' : 'Crear'} KPI
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
