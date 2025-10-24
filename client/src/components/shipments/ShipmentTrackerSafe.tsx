import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, Leaf, Package, Truck, AlertTriangle, 
  CheckCircle, XCircle, Map, Calendar, Plus
} from "lucide-react";
import { useLocation } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Tipos para empresas y envíos
interface Company {
  id: number;
  name: string;
  description?: string;
  sector?: string;
}

interface Shipment {
  id: number;
  companyId: number;
  trackingCode: string;
  customerName: string;
  destination: string;
  origin: string;
  product: string;
  quantity: string;
  unit: string;
  departureDate: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
  carrier: string;
  vehicleInfo: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  distance: string | null;
  carbonFootprint: string | null;
  driverName: string | null;
  driverPhone: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

const StatusBadge = ({ status }: { status: Shipment['status'] }) => {
  const statusMap = {
    pending: { label: "Pendiente", color: "bg-blue-100 text-blue-800" },
    in_transit: { label: "En tránsito", color: "bg-orange-100 text-orange-800" },
    delayed: { label: "Retrasado", color: "bg-red-100 text-red-800" },
    delivered: { label: "Entregado", color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-800" },
  };

  const { label, color } = statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800" };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
      {label}
    </span>
  );
};

export function ShipmentTrackerSafe() {
  const [location, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  
  // Consulta para obtener empresas
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    retry: 1,
    onError: (error) => {
      console.error("Error loading companies:", error);
      setError("Error al cargar empresas");
    }
  });

  // Consulta para obtener envíos
  const { data: shipments = [], isLoading: isLoadingShipments } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments"],
    retry: 1,
    onError: (error) => {
      console.error("Error loading shipments:", error);
      setError("Error al cargar envíos");
    }
  });

  // Calcular conteos de estado de forma segura
  const getStatusCounts = () => {
    const counts = {
      pending: 0,
      in_transit: 0,
      delayed: 0,
      delivered: 0,
      cancelled: 0
    };

    if (Array.isArray(shipments)) {
      shipments.forEach((shipment) => {
        if (shipment && shipment.status && counts.hasOwnProperty(shipment.status)) {
          counts[shipment.status]++;
        }
      });
    }

    return counts;
  };

  const statusCounts = getStatusCounts();

  // Mostrar carga
  if (isLoadingShipments || isLoadingCompanies) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Cargando envíos...</p>
        </div>
      </div>
    );
  }

  // Mostrar error
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Seguimiento de Envíos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Responsable: <span className="font-medium text-primary">Thalia Rodriguez</span> - Departamento de Logística
          </p>
        </div>
        <Button onClick={() => setLocation("/shipments/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Envío
        </Button>
      </div>

      {/* Resumen de estados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-blue-600">{statusCounts.pending}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En Tránsito</p>
                <p className="text-2xl font-bold text-orange-600">{statusCounts.in_transit}</p>
              </div>
              <Truck className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Retrasados</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.delayed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Entregados</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.delivered}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de envíos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Envíos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!Array.isArray(shipments) || shipments.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay envíos registrados</h3>
              <p className="text-gray-600 mb-4">Comienza creando tu primer envío</p>
              <Button onClick={() => setLocation("/shipments/new")}>
                Crear primer envío
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {shipments.slice(0, 5).map((shipment) => (
                <div key={shipment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-medium text-gray-900">{shipment.trackingCode}</p>
                          <p className="text-sm text-gray-600">{shipment.customerName}</p>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm text-gray-600">{shipment.origin} → {shipment.destination}</p>
                          <p className="text-sm text-gray-500">{shipment.product}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={shipment.status} />
                      <Button variant="outline" size="sm">
                        Ver detalles
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {shipments.length > 5 && (
                <div className="text-center pt-4">
                  <Button variant="outline">
                    Ver todos los envíos
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}