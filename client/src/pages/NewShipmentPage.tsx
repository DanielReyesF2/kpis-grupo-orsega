import { devLog } from "@/lib/logger";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Calendar, ArrowLeft, Truck, Calculator, CheckCircle2, ChevronRight, ChevronLeft, Plus, X } from "lucide-react";
import { ZipCodeAutocomplete } from "@/components/shipments/ZipCodeAutocomplete";
import { calculateDistanceBetweenAddresses } from "@/utils/geo-utils";

// NOTA: Las listas hardcodeadas han sido reemplazadas por datos reales de la base de datos
// Los productos ahora se obtienen dinámicamente de envíos anteriores
// Los transportistas ahora se obtienen de /api/providers

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertShipmentSchema } from "@shared/schema";

// Factores de emisión de CO2 por tipo de vehículo y combustible (kg CO2e/km)
const EMISSION_FACTORS = {
  "Camión": {
    "Diesel": 0.9, // kg CO2e/km para camión diésel
    "Gasolina": 1.1, // kg CO2e/km para camión a gasolina
    "GNC": 0.7, // kg CO2e/km para camión a gas natural comprimido
    "Eléctrico": 0.1 // kg CO2e/km para camión eléctrico (considerando emisiones de generación eléctrica)
  },
  "Camión refrigerado": {
    "Diesel": 1.2, // kg CO2e/km para camión refrigerado diésel
    "Gasolina": 1.4, // kg CO2e/km para camión refrigerado a gasolina
    "GNC": 1.0, // kg CO2e/km para camión refrigerado a gas natural comprimido
    "Eléctrico": 0.4 // kg CO2e/km para camión refrigerado eléctrico
  },
  "Cisterna": {
    "Diesel": 1.1, // kg CO2e/km para cisterna diésel
    "Gasolina": 1.3, // kg CO2e/km para cisterna a gasolina
    "GNC": 0.9, // kg CO2e/km para cisterna a gas natural comprimido
    "Eléctrico": 0.3 // kg CO2e/km para cisterna eléctrica
  },
  "Trailer": {
    "Diesel": 1.1, // kg CO2e/km para trailer diésel
    "Gasolina": 1.3, // kg CO2e/km para trailer a gasolina
    "GNC": 0.8, // kg CO2e/km para trailer a gas natural comprimido
    "Eléctrico": 0.3 // kg CO2e/km para trailer eléctrico
  },
  "Tanque": {
    "Diesel": 1.1, // kg CO2e/km para tanque diésel
    "Gasolina": 1.3, // kg CO2e/km para tanque a gasolina
    "GNC": 0.9, // kg CO2e/km para tanque a gas natural comprimido
    "Eléctrico": 0.3 // kg CO2e/km para tanque eléctrico
  }
};

// Esquema extendido para el formulario de envío
const shipmentFormSchema = insertShipmentSchema
  // Reemplazamos companyId number por string para el formulario
  .omit({ companyId: true })
  .extend({
    companyId: z.string().min(1, { message: "La empresa es requerida" }),
    departureDate: z.string().min(1, { message: "La fecha de salida es requerida" }),
    estimatedDeliveryDate: z.string().min(1, { message: "La fecha estimada de entrega es requerida" }),
    vehicleType: z.string().min(1, { message: "El tipo de vehículo es requerido" }),
    fuelType: z.string().min(1, { message: "El tipo de combustible es requerido" }),
    distance: z.string().min(1, { message: "La distancia es requerida" }),
    transportCost: z.number().min(0, { message: "El costo debe ser mayor o igual a 0" }).optional()
  })
  .refine((data) => {
    const departureDate = new Date(data.departureDate);
    const estimatedDeliveryDate = new Date(data.estimatedDeliveryDate);
    return estimatedDeliveryDate >= departureDate;
  }, {
    message: "La fecha estimada de entrega debe ser posterior a la fecha de salida",
    path: ["estimatedDeliveryDate"],
  });

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

// Tipo para items del embarque
interface ShipmentItemForm {
  product: string;
  quantity: string;
  unit: string;
  description?: string;
}

export default function NewShipmentPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [showCarbonSection, setShowCarbonSection] = useState(false);
  const [calculatedCarbonFootprint, setCalculatedCarbonFootprint] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [shipmentItems, setShipmentItems] = useState<ShipmentItemForm[]>([
    { product: "", quantity: "", unit: "KG", description: "" }
  ]);
  
  // Configuración de pasos del asistente
  const totalSteps = 4;
  const stepTitles = [
    "Información Básica",
    "Logística",
    "Huella de Carbono",
    "Información Adicional"
  ];

  // Consulta para obtener empresas
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ["/api/companies"],
  });

  // Consulta para obtener clientes desde la nueva base de datos
  const { data: clients, isLoading: isLoadingClients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Consulta para obtener proveedores reales de transporte
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery<any[]>({
    queryKey: ["/api/providers"],
  });

  // Configuración del formulario
  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      trackingCode: generateTrackingCode(), // Inicialmente sin empresa seleccionada (usará DUR por defecto)
      companyId: "", // Se guardará como string pero se convertirá a número al enviar
      customerName: "",
      customerEmail: "", // Email del cliente para notificaciones automáticas
      destination: "",
      origin: "",
      product: "",
      quantity: "",
      unit: "KG",
      status: "pending",
      carrier: "",
      vehicleType: "",
      fuelType: "Diesel",
      distance: "",
      departureDate: format(new Date(), "yyyy-MM-dd"),
      estimatedDeliveryDate: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    },
  });

  // Filtrar productos por empresa seleccionada
  const selectedCompanyId = form.watch("companyId");
  
  // Consulta para obtener productos desde la tabla products, filtrados por empresa
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ["/api/products", { companyId: selectedCompanyId }],
    enabled: !!selectedCompanyId, // Solo ejecutar si hay empresa seleccionada
  });

  const filteredProducts = products;

  // Efecto para calcular automáticamente la distancia cuando cambian origen y destino
  useEffect(() => {
    const origin = form.getValues("origin");
    const destination = form.getValues("destination");
    
    if (origin && destination && currentStep === 3) {
      // Intentar calcular la distancia entre origen y destino
      const distance = calculateDistanceBetweenAddresses(origin, destination);
      
      if (distance) {
        // Actualizar el campo de distancia con el valor calculado
        form.setValue("distance", distance.toString());
        
        toast({
          title: "Distancia calculada automáticamente",
          description: `Se ha calculado una distancia de ${distance} km entre origen y destino.`,
        });
      } else {
        // Si no se puede calcular la distancia automáticamente, usar un valor predeterminado
        const defaultDistance = "350"; // km
        form.setValue("distance", defaultDistance);
        
        toast({
          title: "Usando distancia predeterminada",
          description: `No fue posible calcular la distancia exacta. Se ha establecido un valor predeterminado de ${defaultDistance} km que puedes editar manualmente.`,
        });
      }
    }
  }, [currentStep, form, toast]);

  // Mutación para crear un nuevo envío
  const createShipmentMutation = useMutation({
    mutationFn: async (values: any) => {
      // Verificar que companyId sea válido
      if (!values.companyId) {
        throw new Error("Debe seleccionar una empresa");
      }
      
      // Validar que haya al menos un producto
      const validItems = shipmentItems.filter(item => item.product && item.quantity);
      if (validItems.length === 0) {
        throw new Error("Debe agregar al menos un producto");
      }
      
      const companyIdNum = parseInt(values.companyId);
      if (isNaN(companyIdNum)) {
        throw new Error("ID de empresa inválido");
      }
      
      // La huella de carbono ya está como número, simplemente usar el valor
      let carbonFootprintNumber = calculatedCarbonFootprint || 0;
      
      devLog.log(`[Nuevo envío] Huella de carbono calculada: ${carbonFootprintNumber} kg CO2e`);
      devLog.log(`[Nuevo envío] Productos: ${validItems.length}`);
      
      // Convertir fechas de string a formato ISO
      const formattedValues = {
        ...values,
        departureDate: new Date(values.departureDate).toISOString(),
        estimatedDeliveryDate: new Date(values.estimatedDeliveryDate).toISOString(),
        companyId: companyIdNum, // Usar el valor ya convertido y validado
        carbonFootprint: carbonFootprintNumber, // Guardar como número
        items: validItems // Agregar items al request
      };
      
      const response = await apiRequest("POST", "/api/shipments", formattedValues);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Envío creado",
        description: "El envío se ha creado correctamente",
      });
      // Invalidar todas las queries relacionadas con shipments para actualizar el dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/shipments"] }); // Por compatibilidad
      navigate("/shipments");
    },
    onError: (error: any) => {
      devLog.error("Error al crear envío:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el envío. Verifica todos los campos.",
        variant: "destructive",
      });
    },
  });

  // Función para calcular y establecer la huella de carbono
  const calculateCarbonFootprint = () => {
    const vehicleType = form.getValues("vehicleType");
    const fuelType = form.getValues("fuelType");
    let distance = parseFloat(form.getValues("distance") || "0");
    
    // Si no hay distancia, usar una predeterminada
    if (!distance && distance !== 0) {
      distance = 350; // km (valor predeterminado)
      form.setValue("distance", distance.toString());
      toast({
        title: "Distancia ajustada",
        description: "Se ha establecido una distancia predeterminada de 350 km para el cálculo.",
      });
    }
    
    // Verificar tipo de vehículo y combustible
    if (!vehicleType || !fuelType) {
      toast({
        title: "Datos incompletos",
        description: "Por favor, selecciona un tipo de vehículo y combustible antes de calcular.",
        variant: "destructive",
      });
      return;
    }
    
    // Obtener el factor de emisión
    let emissionFactor = EMISSION_FACTORS[vehicleType as keyof typeof EMISSION_FACTORS]?.[fuelType as keyof (typeof EMISSION_FACTORS)["Camión"]];
    
    // Si no se encuentra la combinación exacta, usar un factor predeterminado
    if (!emissionFactor) {
      emissionFactor = 0.9; // Factor predeterminado (kg CO2e/km)
      
      toast({
        title: "Usando factor predeterminado",
        description: "Se ha usado un factor de emisión general para el cálculo.",
        variant: "default",
      });
    }
    
    // Calcular la huella de carbono (kg CO2e)
    const carbonFootprintValue = distance * emissionFactor;
    const carbonFootprintFormatted = carbonFootprintValue.toFixed(0);
    
    // Guardar el valor numérico sin formatear
    setCalculatedCarbonFootprint(carbonFootprintValue);
    setShowCarbonSection(true);
    
    toast({
      title: "Cálculo realizado",
      description: `Huella de carbono estimada: ${carbonFootprintFormatted} kg CO2e`,
    });
  };

  // Generar código de seguimiento único basado en la empresa seleccionada
  function generateTrackingCode(companyId?: string) {
    let prefix = "DUR"; // Valor predeterminado Dura International
    
    // Si hay una companyId específica, usarla para determinar el prefijo
    if (companyId) {
      // Dura International (ID: 1)
      if (companyId === "1") {
        prefix = "DUR";
      } 
      // Grupo Orsega (ID: 2)
      else if (companyId === "2") {
        prefix = "ORS";
      }
    }
    
    const date = new Date();
    const year = date.getFullYear().toString().substr(2, 2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `${prefix}-${year}${month}-${randomNum}`;
  }

  // Función para avanzar al siguiente paso
  const goToNextStep = () => {
    // Validar los campos del paso actual
    let isValid = true;
    
    if (currentStep === 1) {
      // Validar campos del paso 1: Información Básica
      const companyId = form.getValues("companyId");
      const customerName = form.getValues("customerName");
      const product = form.getValues("product");
      const quantity = form.getValues("quantity");
      
      if (!companyId || !customerName || !product || !quantity) {
        toast({
          title: "Campos incompletos",
          description: "Por favor, completa todos los campos obligatorios antes de continuar",
          variant: "destructive",
        });
        isValid = false;
      }
    } else if (currentStep === 2) {
      // Validar campos del paso 2: Logística
      const origin = form.getValues("origin");
      const destination = form.getValues("destination");
      const departureDate = form.getValues("departureDate");
      const estimatedDeliveryDate = form.getValues("estimatedDeliveryDate");
      const carrier = form.getValues("carrier");
      
      // Validación simple y flexible para campos críticos
      const missingFields = [];
      
      if (!origin || origin.trim().length < 2) {
        missingFields.push("Origen");
      }
      
      if (!destination || destination.trim().length < 2) {
        missingFields.push("Destino");
      }
      
      if (!departureDate) {
        missingFields.push("Fecha de salida");
      }
      
      if (!estimatedDeliveryDate) {
        missingFields.push("Fecha estimada de entrega");
      }
      
      if (missingFields.length > 0) {
        toast({
          title: "Campos incompletos",
          description: `Completa: ${missingFields.join(", ")}`,
          variant: "destructive",
        });
        isValid = false;
      }
      
      // Validación de fechas lógicas
      if (departureDate && estimatedDeliveryDate) {
        const departure = new Date(departureDate);
        const delivery = new Date(estimatedDeliveryDate);
        
        if (delivery <= departure) {
          toast({
            title: "Error en fechas",
            description: "La fecha de entrega debe ser posterior a la fecha de salida",
            variant: "destructive",
          });
          isValid = false;
        }
      }
    } else if (currentStep === 3) {
      // Validar campos del paso 3: Huella de Carbono
      if (!calculatedCarbonFootprint) {
        toast({
          title: "Cálculo pendiente",
          description: "Por favor, calcula la huella de carbono antes de continuar",
          variant: "destructive",
        });
        isValid = false;
      }
    }
    
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  // Función para regresar al paso anterior
  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const onSubmit = (values: ShipmentFormValues) => {
    // Si no se ha calculado la huella de carbono, mostrar alerta
    if (!calculatedCarbonFootprint) {
      toast({
        title: "Huella de carbono",
        description: "Por favor, calcula la huella de carbono antes de crear el envío",
        variant: "default",
      });
      return;
    }
    
    createShipmentMutation.mutate(values);
  };

  if (isLoadingCompanies) {
    return (
      <AppLayout title="Nuevo Envío">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Nuevo Envío">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center space-x-2 mb-4 sm:mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/shipments")}>
            <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="text-xs sm:text-sm">Volver a Envíos</span>
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="py-4 sm:py-6">
            <CardTitle className="text-lg sm:text-xl">Nuevo Envío</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Completa el formulario para crear un nuevo envío. 
              <span className="block mt-1 text-primary font-medium">
                Responsable de Logística: Thalia Rodriguez
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {/* Indicador de progreso en pasos */}
            <div className="mb-6">
              <div className="flex justify-between">
                {stepTitles.map((title, index) => (
                  <div 
                    key={index} 
                    className={`flex flex-col items-center text-center flex-1 ${index > 0 ? "ml-4" : ""}`}
                  >
                    <div 
                      className={`flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                        currentStep > index + 1 
                          ? "bg-green-100 text-green-600 border border-green-600" 
                          : currentStep === index + 1 
                            ? "bg-primary text-white" 
                            : "bg-gray-100 text-gray-400 border border-gray-300"
                      }`}
                    >
                      {currentStep > index + 1 ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-xs sm:text-sm ${
                      currentStep === index + 1 ? "font-semibold text-primary" : "text-gray-500"
                    }`}>
                      {title}
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative flex items-center mt-1">
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Paso 1: Información Básica */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="trackingCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código de seguimiento</FormLabel>
                            <FormControl>
                              <Input {...field} readOnly />
                            </FormControl>
                            <FormDescription>
                              Código generado automáticamente
                            </FormDescription>
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
                              onValueChange={(value) => {
                                field.onChange(value);
                                
                                // Resetear el producto seleccionado si cambia la empresa
                                form.setValue("product", "");
                                
                                // Generar nuevo código de seguimiento basado en la empresa seleccionada
                                const newTrackingCode = generateTrackingCode(value);
                                form.setValue("trackingCode", newTrackingCode);
                                
                                // Notificar al usuario del cambio
                                toast({
                                  title: "Código actualizado",
                                  description: `Se ha generado un nuevo código de seguimiento: ${newTrackingCode}`,
                                });
                              }} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una empresa" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(companies as any[])?.map((company: any) => (
                                  <SelectItem key={company.id} value={company.id.toString()}>
                                    {company.name}
                                  </SelectItem>
                                )) || []}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Cliente</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Nombre completo del cliente"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Sección de Productos Múltiples */}
                      <div className="col-span-2">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Productos</h3>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShipmentItems([...shipmentItems, { product: "", quantity: "", unit: "KG", description: "" }])}
                              data-testid="button-add-product"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Agregar Producto
                            </Button>
                          </div>
                          
                          {shipmentItems.map((item, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-4 relative" data-testid={`product-item-${index}`}>
                              {shipmentItems.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => {
                                    const newItems = shipmentItems.filter((_, i) => i !== index);
                                    setShipmentItems(newItems);
                                  }}
                                  data-testid={`button-remove-product-${index}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              
                              <div className="font-medium text-sm text-muted-foreground">Producto {index + 1}</div>
                              
                              <div className="space-y-3">
                                <div>
                                  <label className="text-sm font-medium">Nombre del Producto</label>
                                  {!selectedCompanyId ? (
                                    <Input 
                                      placeholder="Primero selecciona una empresa" 
                                      disabled 
                                    />
                                  ) : isLoadingProducts ? (
                                    <Input placeholder="Cargando productos..." disabled />
                                  ) : filteredProducts.length > 0 ? (
                                    <Select 
                                      value={item.product} 
                                      onValueChange={(value) => {
                                        const newItems = [...shipmentItems];
                                        newItems[index].product = value;
                                        setShipmentItems(newItems);
                                      }}
                                    >
                                      <SelectTrigger data-testid={`select-product-${index}`}>
                                        <SelectValue placeholder="Seleccione un producto" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {filteredProducts.map((product: any) => (
                                          <SelectItem key={product.id} value={product.name}>
                                            {product.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={item.product}
                                      onChange={(e) => {
                                        const newItems = [...shipmentItems];
                                        newItems[index].product = e.target.value;
                                        setShipmentItems(newItems);
                                      }}
                                      placeholder="Escriba el nombre del producto"
                                      data-testid={`input-product-${index}`}
                                    />
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium">Cantidad</label>
                                    <Input
                                      type="text"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newItems = [...shipmentItems];
                                        newItems[index].quantity = e.target.value;
                                        setShipmentItems(newItems);
                                      }}
                                      placeholder="Ej: 5000"
                                      data-testid={`input-quantity-${index}`}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="text-sm font-medium">Unidad</label>
                                    <Select 
                                      value={item.unit} 
                                      onValueChange={(value) => {
                                        const newItems = [...shipmentItems];
                                        newItems[index].unit = value;
                                        setShipmentItems(newItems);
                                      }}
                                    >
                                      <SelectTrigger data-testid={`select-unit-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="KG">Kilogramos</SelectItem>
                                        <SelectItem value="L">Litros</SelectItem>
                                        <SelectItem value="TON">Toneladas</SelectItem>
                                        <SelectItem value="unidades">Unidades</SelectItem>
                                        <SelectItem value="cajas">Cajas</SelectItem>
                                        <SelectItem value="pallets">Pallets</SelectItem>
                                        <SelectItem value="Full">Full</SelectItem>
                                        <SelectItem value="Sencillo">Sencillo</SelectItem>
                                        <SelectItem value="Pipa">Pipa</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="origin"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>Origen</FormLabel>
                              <ZipCodeAutocomplete
                                placeholder="Ej: Altamira, Nextipac, CDMX..."
                                value={field.value}
                                onChange={field.onChange}
                                name={field.name}
                                disabled={field.disabled}
                              />
                              <div className="text-xs text-muted-foreground">
                                Escribe cualquier ubicación. Las sugerencias son opcionales.
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="destination"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>Destino</FormLabel>
                              <ZipCodeAutocomplete
                                placeholder="Ej: Altamira, Nextipac, CDMX..."
                                value={field.value}
                                onChange={field.onChange}
                                name={field.name}
                                disabled={field.disabled}
                              />
                              <div className="text-xs text-muted-foreground">
                                Escribe cualquier ubicación. Las sugerencias son opcionales.
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Paso 2: Logística */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <Alert className="mb-4 bg-blue-50 border-blue-200">
                      <AlertTitle className="text-primary font-medium">Información de Logística</AlertTitle>
                      <AlertDescription>
                        La logística de este envío está gestionada por <span className="font-medium">Thalia Rodriguez</span>. 
                        Por favor, complete los datos de forma precisa para facilitar el seguimiento.
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="departureDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de salida</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <Input 
                                  type="date" 
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="estimatedDeliveryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha estimada de entrega</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <Input 
                                  type="date" 
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="carrier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transportista</FormLabel>
                            {isLoadingProviders ? (
                              <div className="space-y-2">
                                <FormControl>
                                  <Input 
                                    placeholder="Cargando proveedores..."
                                    disabled 
                                  />
                                </FormControl>
                                <FormDescription>
                                  Obteniendo proveedores de transporte...
                                </FormDescription>
                              </div>
                            ) : (providers || []).length > 0 ? (
                              <div className="space-y-2">
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona un proveedor de transporte" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(providers || []).map((provider: any) => (
                                      <SelectItem key={provider.id} value={provider.name}>
                                        <div>
                                          <div className="font-medium">{provider.name}</div>
                                          {provider.email && (
                                            <div className="text-xs text-muted-foreground">{provider.email}</div>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  {(providers || []).length} proveedor(es) de transporte disponible(s)
                                </FormDescription>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ''}
                                    placeholder="Escriba el nombre del transportista (no hay proveedores registrados)"
                                  />
                                </FormControl>
                                <FormDescription>
                                  No hay proveedores registrados. Puede escribir el nombre manualmente.
                                </FormDescription>
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vehicleInfo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Información del vehículo</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="Ej: Cisterna C-3540" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="transportCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Costo de Transporte (MXN)
                              <span className="text-red-500 ml-1">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ej: 1500.00"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : "")}
                              />
                            </FormControl>
                            <FormDescription>
                              Ingrese el costo total de transporte en pesos mexicanos
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Campos de conductor eliminados por petición de Thalia (Logística) */}
                    </div>
                  </div>
                )}

                {/* Paso 3: Huella de Carbono */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="vehicleType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de vehículo</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un tipo de vehículo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Camión">Camión</SelectItem>
                                <SelectItem value="Camión refrigerado">Camión refrigerado</SelectItem>
                                <SelectItem value="Cisterna">Cisterna</SelectItem>
                                <SelectItem value="Trailer">Trailer</SelectItem>
                                <SelectItem value="Tanque">Tanque</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fuelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de combustible</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un tipo de combustible" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Diesel">Diesel</SelectItem>
                                <SelectItem value="Gasolina">Gasolina</SelectItem>
                                <SelectItem value="GNC">Gas Natural Comprimido</SelectItem>
                                <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="distance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Distancia (km)</FormLabel>
                            <div className="flex space-x-2">
                              <FormControl className="flex-1">
                                <Input {...field} 
                                  type="number" 
                                  placeholder="Calculado automáticamente desde origen y destino" 
                                  min="1"
                                />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="icon"
                                onClick={() => {
                                  const origin = form.getValues("origin");
                                  const destination = form.getValues("destination");
                                  if (origin && destination) {
                                    const distance = calculateDistanceBetweenAddresses(origin, destination);
                                    if (distance) {
                                      form.setValue("distance", distance.toString());
                                      toast({
                                        title: "Distancia recalculada",
                                        description: `Se ha calculado una distancia de ${distance} km entre origen y destino.`,
                                      });
                                    } else {
                                      toast({
                                        title: "No se pudo calcular la distancia",
                                        description: "Asegúrate de que los campos de origen y destino contengan códigos postales válidos.",
                                        variant: "destructive",
                                      });
                                    }
                                  } else {
                                    toast({
                                      title: "Datos incompletos",
                                      description: "Debes seleccionar un origen y un destino para calcular la distancia.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                title="Recalcular distancia"
                              >
                                <Calculator className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormDescription>
                              Se calcula automáticamente a partir del origen y destino seleccionados
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-center mt-4">
                      <Button
                        type="button"
                        onClick={calculateCarbonFootprint}
                        className="bg-primary text-white flex items-center gap-2"
                      >
                        <Calculator className="h-4 w-4" />
                        Calcular huella de carbono
                      </Button>
                    </div>

                    {showCarbonSection && calculatedCarbonFootprint && (
                      <Alert className="mt-4 bg-green-50 border-green-200">
                        <Calculator className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-700 text-sm">Huella de carbono calculada</AlertTitle>
                        <AlertDescription className="text-green-700 text-xs sm:text-sm">
                          Se estima que este envío generará aproximadamente <span className="font-bold">{calculatedCarbonFootprint ? calculatedCarbonFootprint.toFixed(0) : "0"} kg de CO2e</span>.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Paso 4: Información Adicional */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="customerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email del cliente</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="correo@ejemplo.com" 
                                className="w-full" 
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="customerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono del cliente</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Número de teléfono" 
                                className="w-full" 
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comentarios adicionales</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Ingrese cualquier información adicional relevante para este envío" 
                              className="w-full min-h-[120px]" 
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="flex justify-between pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/shipments")}
                    className="text-xs sm:text-sm"
                  >
                    Cancelar
                  </Button>
                  
                  <div className="flex space-x-2">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={goToPreviousStep}
                        className="text-xs sm:text-sm flex items-center"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                    )}
                    
                    {currentStep < totalSteps ? (
                      <Button
                        type="button"
                        onClick={goToNextStep}
                        className="text-xs sm:text-sm bg-primary text-white flex items-center"
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="text-xs sm:text-sm bg-primary text-white"
                        disabled={createShipmentMutation.isPending}
                      >
                        {createShipmentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Crear Envío"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}