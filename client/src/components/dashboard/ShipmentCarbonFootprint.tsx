import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Leaf } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ShipmentCarbonFootprint() {
  const [totalCarbonFootprint, setTotalCarbonFootprint] = useState<number>(0);
  const queryClient = useQueryClient();

  // Utilizar los datos de envíos ya cargados en el cache
  const { 
    data: shipments,
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/shipments'],
    staleTime: 2 * 60 * 1000, // Los datos son válidos por 2 minutos
    refetchInterval: 30000, // Refrescar cada 30 segundos (reducido desde 5s)
    refetchOnWindowFocus: false, // Deshabilitado para reducir requests
  });

  // Calcular huella de carbono total cuando los envíos cambian
  useEffect(() => {
    if (shipments && Array.isArray(shipments)) {
      let totalCarbonKg = 0;
      
      shipments.forEach((shipment: any) => {
        if (shipment.carbonFootprint) {
          // Si es un número, simplemente sumar
          if (typeof shipment.carbonFootprint === 'number') {
            totalCarbonKg += shipment.carbonFootprint;
          } 
          // Si es un string, extraer los números
          else if (typeof shipment.carbonFootprint === 'string') {
            const carbonValue = parseFloat(shipment.carbonFootprint.replace(/[^\d.-]/g, ''));
            if (!isNaN(carbonValue)) {
              totalCarbonKg += carbonValue;
            }
          }
        }
      });
      
      
      // Para debugging, mostrar los envíos con sus huellas
      shipments.forEach((shipment: any, index: number) => {
      });
      
      setTotalCarbonFootprint(totalCarbonKg);
    }
  }, [shipments]);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500">
        Error al cargar datos de emisiones
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-end">
          <span className="text-4xl font-bold text-[#273949]">{(totalCarbonFootprint / 1000).toFixed(2)}</span>
          <span className="text-lg ml-2 text-gray-600">toneladas CO₂e</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Basado en {Array.isArray(shipments) ? shipments.length : 0} envíos registrados
        </p>
      </div>
      <div className="bg-[#edfad2] p-3 rounded-lg">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#b5e951] flex items-center justify-center">
            <Leaf className="h-6 w-6 text-[#273949]" />
          </div>
          <span className="text-xs font-medium text-[#273949] mt-1">Alcance 3</span>
        </div>
      </div>
    </div>
  );
}