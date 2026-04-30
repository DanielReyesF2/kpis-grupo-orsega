import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUpload } from "@/lib/queryClient";
import { useCompanyFilter } from "@/hooks/use-company-filter";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { ImportDropZone } from "@/components/imports/ImportDropZone";
import { ImportOrderForm } from "@/components/imports/ImportOrderForm";
import { ImportKanban } from "@/components/imports/ImportKanban";
import { ImportOrderDetail } from "@/components/imports/ImportOrderDetail";
import { ImportHistory } from "@/components/imports/ImportHistory";
import { ShipmentCalendar } from "@/components/shipments/ShipmentCalendar";

export default function ImportOrdersPage() {
  const { selectedCompany } = useCompanyFilter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("activas");
  const [isExtractingOC, setIsExtractingOC] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch import orders
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/import-orders", { companyId: selectedCompany }],
  });

  // Fetch shipments for calendar
  const { data: shipments = [] } = useQuery<any[]>({
    queryKey: ["/api/shipments", { companyId: selectedCompany, limit: "all" }],
  });

  // Active orders (not completed/cancelled)
  const activeOrders = orders.filter(
    (o: any) => o.status !== "in_warehouse" && o.status !== "cancelled"
  );

  // Handle file drop → AI extraction
  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setIsExtractingOC(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload("POST", "/api/import-orders/extract", formData);
      const data = await res.json();

      setExtractedData(data.extracted);
      setShowForm(true);
    } catch (error) {
      console.error("Error extracting OC:", error);
      // Show form with empty data so user can fill manually
      setExtractedData({
        supplierName: null,
        supplierCountry: null,
        products: [],
        currency: "USD",
        incoterm: null,
        totalValue: null,
        purchaseOrderNumber: null,
        estimatedShipDate: null,
        estimatedArrivalDate: null,
      });
      setShowForm(true);
      toast({
        title: "No se pudieron extraer datos",
        description: "Llena los datos manualmente",
        variant: "destructive",
      });
    } finally {
      setIsExtractingOC(false);
    }
  };

  // Handle form submit → create import order
  const handleCreateOrder = async (data: any) => {
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      const res = await apiUpload("POST", "/api/import-orders", formData);
      const created = await res.json();

      toast({
        title: "Importación creada",
        description: `${created.reference} — ${data.supplierName}`,
      });

      setShowForm(false);
      setExtractedData(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/import-orders"] });
    } catch (error) {
      console.error("Error creating import order:", error);
      toast({
        title: "Error creando importación",
        description: "Revisa los datos e intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOrderClick = (order: any) => {
    setSelectedOrderId(order.id);
  };

  // Build calendar events (imports as pseudo-shipments for the shared calendar)
  const importCalendarEvents = orders
    .filter((o: any) => o.status !== "cancelled")
    .map((o: any) => ({
      id: -(o.id + 1), // Negative IDs to avoid collision with shipment IDs
      trackingCode: o.reference,
      customerName: o.supplier_name,
      product: o.items?.[0]?.product_name || o.items?.[0]?.productName || "Importación",
      origin: o.supplier_country || "Internacional",
      destination: o.destination === "directo_cliente" ? o.destination_detail || "Cliente" : "Bodega Nextipac",
      status: o.status === "in_warehouse" ? "delivered" : o.status === "cancelled" ? "cancelled" : "in_transit",
      departureDate: o.estimated_ship_date || o.actual_ship_date,
      estimatedDeliveryDate: o.estimated_arrival_date,
      actualDeliveryDate: o.actual_warehouse_date,
      companyId: o.company_id,
    }));

  const allCalendarEvents = [...shipments, ...importCalendarEvents];

  return (
    <AppLayout title="Importaciones">
      {/* Calendar */}
      <ShipmentCalendar shipments={allCalendarEvents} className="mb-4" />

      {/* Tabs: Active vs History */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activas">Activas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="activas" className="space-y-4 mt-4">
          {/* Drop Zone */}
          <ImportDropZone
            onFileSelected={handleFileSelected}
            isProcessing={isExtractingOC}
          />

          {/* Kanban */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <ImportKanban orders={activeOrders} onOrderClick={handleOrderClick} />
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <ImportHistory companyId={selectedCompany} onOrderClick={handleOrderClick} />
        </TabsContent>
      </Tabs>

      {/* AI Extraction Form Dialog */}
      {showForm && extractedData && (
        <ImportOrderForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setExtractedData(null);
            setSelectedFile(null);
          }}
          onSubmit={handleCreateOrder}
          extractedData={extractedData}
          fileName={selectedFile?.name || ""}
          companyId={selectedCompany}
          isSubmitting={isCreating}
        />
      )}

      {/* Order Detail Dialog */}
      <ImportOrderDetail
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </AppLayout>
  );
}
