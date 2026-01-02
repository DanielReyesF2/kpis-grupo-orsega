import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Download,
  FileText,
  Filter,
  Calendar,
  Building2,
  User,
  DollarSign,
  FileDown,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface AccountingDocument {
  id: number;
  type: "invoice" | "voucher" | "rep";
  companyId: number;
  companyName: string;
  supplierName: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  files: {
    invoice?: { url: string; name: string };
    voucher?: { url: string; name: string };
    complement?: { url: string; name: string };
  };
  extractedData?: {
    invoiceNumber?: string;
    taxId?: string;
    bank?: string;
    reference?: string;
    trackingKey?: string;
  };
}

interface AccountingHubProps {
  className?: string;
}

export function AccountingHub({ className }: AccountingHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);

  // Obtener documentos para contabilidad
  const { data: documents = [], isLoading } = useQuery<AccountingDocument[]>({
    queryKey: ["/api/treasury/accounting/documents"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/treasury/accounting/documents");
      return await response.json();
    },
    staleTime: 30000,
  });

  // Obtener empresas
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    staleTime: 60000,
  });

  // Filtrar documentos
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Filtro por búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.supplierName.toLowerCase().includes(searchLower) ||
          doc.extractedData?.invoiceNumber?.toLowerCase().includes(searchLower) ||
          doc.extractedData?.reference?.toLowerCase().includes(searchLower) ||
          doc.extractedData?.trackingKey?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por tipo
    if (selectedType !== "all") {
      filtered = filtered.filter((doc) => doc.type === selectedType);
    }

    // Filtro por empresa
    if (selectedCompany !== "all") {
      filtered = filtered.filter((doc) => doc.companyId === parseInt(selectedCompany));
    }

    // Filtro por estado
    if (selectedStatus !== "all") {
      filtered = filtered.filter((doc) => doc.status === selectedStatus);
    }

    // Filtro por fecha
    if (dateFrom) {
      filtered = filtered.filter((doc) => {
        const docDate = new Date(doc.date);
        return docDate >= new Date(dateFrom);
      });
    }

    if (dateTo) {
      filtered = filtered.filter((doc) => {
        const docDate = new Date(doc.date);
        const dateToObj = new Date(dateTo);
        dateToObj.setHours(23, 59, 59, 999);
        return docDate <= dateToObj;
      });
    }

    return filtered;
  }, [documents, searchTerm, selectedType, selectedCompany, selectedStatus, dateFrom, dateTo]);

  // Descarga masiva
  const handleBatchDownload = async () => {
    if (selectedDocuments.length === 0) {
      alert("Selecciona al menos un documento para descargar");
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/treasury/accounting/download-batch", {
        documentIds: selectedDocuments,
      });

      // Crear link de descarga
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documentos-contabilidad-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando documentos:", error);
      alert("Error al descargar documentos");
    }
  };

  // Exportar resumen
  const handleExportSummary = async () => {
    try {
      const response = await apiRequest("GET", "/api/treasury/accounting/export", {
        filters: {
          type: selectedType,
          company: selectedCompany,
          status: selectedStatus,
          dateFrom,
          dateTo,
        },
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumen-contabilidad-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exportando resumen:", error);
      alert("Error al exportar resumen");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      factura_pagada: { label: "Factura Pagada", variant: "default" },
      pendiente_complemento: { label: "Pendiente Complemento", variant: "secondary" },
      complemento_recibido: { label: "Complemento Recibido", variant: "outline" },
      cierre_contable: { label: "Cierre Contable", variant: "default" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "invoice":
        return <FileText className="h-4 w-4" />;
      case "voucher":
        return <CheckCircle className="h-4 w-4" />;
      case "rep":
        return <Clock className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hub de Contabilidad</h2>
          <p className="text-sm text-muted-foreground">
            Acceso centralizado a todos los documentos de facturas, comprobantes y REPs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportSummary}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Resumen
          </Button>
          {selectedDocuments.length > 0 && (
            <Button variant="outline" onClick={handleBatchDownload}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Seleccionados ({selectedDocuments.length})
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por proveedor, número, referencia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Tipo de documento */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Documento</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="invoice">Facturas</SelectItem>
                  <SelectItem value="voucher">Comprobantes</SelectItem>
                  <SelectItem value="rep">REPs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Empresa */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="factura_pagada">Factura Pagada</SelectItem>
                  <SelectItem value="pendiente_complemento">Pendiente Complemento</SelectItem>
                  <SelectItem value="complemento_recibido">Complemento Recibido</SelectItem>
                  <SelectItem value="cierre_contable">Cierre Contable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha desde */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Fecha hasta */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de documentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documentos ({filteredDocuments.length})</CardTitle>
              <CardDescription>
                {selectedDocuments.length > 0 && `${selectedDocuments.length} seleccionados`}
              </CardDescription>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
              <TabsList>
                <TabsTrigger value="list">Lista</TabsTrigger>
                <TabsTrigger value="cards">Tarjetas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando documentos...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground font-medium">No se encontraron documentos</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.length === filteredDocuments.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDocuments(filteredDocuments.map((d) => d.id));
                          } else {
                            setSelectedDocuments([]);
                          }
                        }}
                      />
                    </th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Proveedor</th>
                    <th className="text-left p-2">Empresa</th>
                    <th className="text-left p-2">Monto</th>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocuments([...selectedDocuments, doc.id]);
                            } else {
                              setSelectedDocuments(selectedDocuments.filter((id) => id !== doc.id));
                            }
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(doc.type)}
                          <span className="capitalize">{doc.type}</span>
                        </div>
                      </td>
                      <td className="p-2 font-medium">{doc.supplierName}</td>
                      <td className="p-2 text-sm text-muted-foreground">{doc.companyName}</td>
                      <td className="p-2">
                        <span className="font-semibold">
                          {doc.currency} {doc.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-2 text-sm">
                        {format(new Date(doc.date), "dd MMM yyyy", { locale: es })}
                      </td>
                      <td className="p-2">{getStatusBadge(doc.status)}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          {doc.files.invoice && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc.files.invoice!.url, "_blank")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {doc.files.voucher && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc.files.voucher!.url, "_blank")}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  className={cn(
                    "cursor-pointer hover:border-primary transition-colors",
                    selectedDocuments.includes(doc.id) && "border-primary bg-primary/5"
                  )}
                  onClick={() => {
                    if (selectedDocuments.includes(doc.id)) {
                      setSelectedDocuments(selectedDocuments.filter((id) => id !== doc.id));
                    } else {
                      setSelectedDocuments([...selectedDocuments, doc.id]);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(doc.type)}
                        <span className="font-semibold capitalize">{doc.type}</span>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                    <h3 className="font-bold mb-2">{doc.supplierName}</h3>
                    <div className="space-y-1 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        {doc.companyName}
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3" />
                        {doc.currency} {doc.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(doc.date), "dd MMM yyyy", { locale: es })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {doc.files.invoice && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(doc.files.invoice!.url, "_blank");
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Factura
                        </Button>
                      )}
                      {doc.files.voucher && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(doc.files.voucher!.url, "_blank");
                          }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Comprobante
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

