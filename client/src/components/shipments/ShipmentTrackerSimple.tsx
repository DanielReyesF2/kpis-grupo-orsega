import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DragDropKanban } from "@/components/shipments/DragDropKanban";

interface Shipment {
  id: number;
  trackingCode: string;
  customerName: string;
  product: string;
  quantity: number;
  unit: string;
  origin: string;
  destination: string;
  status: string;
  estimatedDeliveryDate: string | null;
  createdAt: string;
  carbonFootprint: number;
}

interface Company {
  id: number;
  name: string;
  description: string;
}

export function ShipmentTrackerSimple() {
  const { toast } = useToast();

  // Consulta para obtener empresas
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Consulta para obtener envíos
  const { data: shipments, isLoading: isLoadingShipments } = useQuery<Shipment[]>({
    queryKey: ['/api/shipments'],
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        

        {/* Tablero Kanban */}
        <DragDropKanban />
        

      </div>
    </div>
  );
}