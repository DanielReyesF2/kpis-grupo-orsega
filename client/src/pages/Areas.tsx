import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { createArea, updateArea } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Pencil, Plus, Layers, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Form validation schema
const areaFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  companyId: z.string().min(1, 'La empresa es requerida'),
});

export default function Areas() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);

  // Fetch areas
  const { data: areas, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['/api/areas'],
  });

  // Fetch companies for dropdown
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['/api/companies'],
  });

  // Setup form with validation
  const form = useForm<z.infer<typeof areaFormSchema>>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      name: '',
      description: '',
      companyId: '',
    },
  });

  // Create area mutation
  const createMutation = useMutation({
    mutationFn: createArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/areas'] });
      toast({
        title: 'Área creada',
        description: 'El área ha sido creada exitosamente.',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo crear el área: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    },
  });

  // Update area mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateArea(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/areas'] });
      toast({
        title: 'Área actualizada',
        description: 'El área ha sido actualizada exitosamente.',
      });
      setIsDialogOpen(false);
      setEditingArea(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo actualizar el área: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: z.infer<typeof areaFormSchema>) => {
    const formattedData = {
      ...data,
      companyId: parseInt(data.companyId),
    };

    if (editingArea) {
      updateMutation.mutate({ id: editingArea.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  // Handle edit area
  const handleEditArea = (area: any) => {
    setEditingArea(area);
    form.reset({
      name: area.name,
      description: area.description || '',
      companyId: area.companyId.toString(),
    });
    setIsDialogOpen(true);
  };

  // Handle new area
  const handleNewArea = () => {
    setEditingArea(null);
    form.reset({
      name: '',
      description: '',
      companyId: '',
    });
    setIsDialogOpen(true);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingArea(null);
    form.reset();
  };

  // Get company name by ID
  const getCompanyName = (companyId: number) => {
    if (!companies) return 'Desconocida';
    const company = companies.find((c: any) => c.id === companyId);
    return company ? company.name : 'Desconocida';
  };

  const isLoading = isLoadingAreas || isLoadingCompanies;

  return (
    <AppLayout title="Gestión de Áreas">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Áreas Funcionales</CardTitle>
          <Button onClick={handleNewArea}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Área
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : areas && areas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area: any) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell>{getCompanyName(area.companyId)}</TableCell>
                    <TableCell>{area.description}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditArea(area)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-secondary-500">
              No hay áreas registradas. Haga clic en "Nueva Área" para crear una.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Area Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingArea ? 'Editar Área' : 'Nueva Área'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del área" {...field} />
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
                      onValueChange={field.onChange}
                      disabled={isLoadingCompanies}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company: any) => (
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descripción del área" 
                        className="min-h-[100px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDialogClose}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingArea ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
