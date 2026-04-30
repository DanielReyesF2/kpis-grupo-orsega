import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Trash2, Plus, Sparkles } from "lucide-react";

interface ExtractedProduct {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
}

interface ExtractedOCData {
  supplierName: string | null;
  supplierCountry: string | null;
  products: ExtractedProduct[];
  currency: string | null;
  incoterm: string | null;
  totalValue: number | null;
  purchaseOrderNumber: string | null;
  estimatedShipDate: string | null;
  estimatedArrivalDate: string | null;
}

interface ImportOrderFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  extractedData: ExtractedOCData;
  fileName: string;
  companyId: number;
  isSubmitting: boolean;
}

const INCOTERMS = ["FOB", "CIF", "EXW", "DDP", "CFR", "FCA", "DAP", "CPT"];
const CURRENCIES = ["USD", "MXN", "EUR", "CNY", "JPY"];
const UNITS = ["KG", "L", "PCS", "TON", "M", "M2", "M3", "GAL", "LB"];

export function ImportOrderForm({
  open,
  onClose,
  onSubmit,
  extractedData,
  fileName,
  companyId,
  isSubmitting,
}: ImportOrderFormProps) {
  const [supplierName, setSupplierName] = useState(extractedData.supplierName || "");
  const [supplierCountry, setSupplierCountry] = useState(extractedData.supplierCountry || "");
  const [incoterm, setIncoterm] = useState(extractedData.incoterm || "");
  const [currency, setCurrency] = useState(extractedData.currency || "USD");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(extractedData.purchaseOrderNumber || "");
  const [products, setProducts] = useState<ExtractedProduct[]>(
    extractedData.products.length > 0 ? extractedData.products : [{ name: "", quantity: null, unit: null, unitPrice: null }]
  );
  const [destination, setDestination] = useState("bodega_nextipac");
  const [destinationDetail, setDestinationDetail] = useState("");
  const [estimatedShipDate, setEstimatedShipDate] = useState(extractedData.estimatedShipDate || "");
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState(extractedData.estimatedArrivalDate || "");

  const totalValue = products.reduce((sum, p) => {
    if (p.quantity && p.unitPrice) return sum + p.quantity * p.unitPrice;
    return sum;
  }, 0);

  const handleSubmit = () => {
    if (!supplierName.trim()) return;

    onSubmit({
      companyId,
      supplierName: supplierName.trim(),
      supplierCountry: supplierCountry || null,
      incoterm: incoterm || null,
      currency,
      purchaseOrderNumber: purchaseOrderNumber || null,
      totalValue: totalValue || extractedData.totalValue || null,
      destination,
      destinationDetail: destination === "directo_cliente" ? destinationDetail : null,
      estimatedShipDate: estimatedShipDate || null,
      estimatedArrivalDate: estimatedArrivalDate || null,
      items: products
        .filter((p) => p.name.trim())
        .map((p) => ({
          productName: p.name.trim(),
          quantity: p.quantity,
          unit: p.unit,
          unitPrice: p.unitPrice,
        })),
    });
  };

  const updateProduct = (index: number, field: keyof ExtractedProduct, value: any) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const removeProduct = (index: number) => {
    if (products.length === 1) return;
    setProducts(products.filter((_, i) => i !== index));
  };

  const addProduct = () => {
    setProducts([...products, { name: "", quantity: null, unit: null, unitPrice: null }]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Nueva Importación (datos extraídos)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File info + company badge */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-600 truncate flex-1">
              {fileName}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${companyId === 1 ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>
              {companyId === 1 ? "DURA" : "ORSEGA"}
            </span>
          </div>

          {/* Datos extraídos */}
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Datos extraídos (revisa y ajusta)
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Proveedor *</Label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nombre del proveedor" />
              </div>
              <div>
                <Label className="text-xs">País</Label>
                <Input value={supplierCountry} onChange={(e) => setSupplierCountry(e.target.value)} placeholder="País del proveedor" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Incoterm</Label>
                <Select value={incoterm} onValueChange={setIncoterm}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">No. OC</Label>
                <Input value={purchaseOrderNumber} onChange={(e) => setPurchaseOrderNumber(e.target.value)} placeholder="PO-2026-001" />
              </div>
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Productos (extraídos del documento)
            </p>

            {products.map((product, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {idx === 0 && <Label className="text-xs">Producto</Label>}
                  <Input
                    value={product.name}
                    onChange={(e) => updateProduct(idx, "name", e.target.value)}
                    placeholder="Nombre del producto"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <Label className="text-xs">Cantidad</Label>}
                  <Input
                    type="number"
                    value={product.quantity ?? ""}
                    onChange={(e) => updateProduct(idx, "quantity", e.target.value ? Number(e.target.value) : null)}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <Label className="text-xs">Unidad</Label>}
                  <Select value={product.unit || ""} onValueChange={(v) => updateProduct(idx, "unit", v)}>
                    <SelectTrigger><SelectValue placeholder="--" /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  {idx === 0 && <Label className="text-xs">P. Unitario</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    value={product.unitPrice ?? ""}
                    onChange={(e) => updateProduct(idx, "unitPrice", e.target.value ? Number(e.target.value) : null)}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-slate-400 hover:text-red-500"
                    onClick={() => removeProduct(idx)}
                    disabled={products.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addProduct} className="text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Agregar producto
            </Button>

            {totalValue > 0 && (
              <p className="text-sm text-right text-slate-600">
                Total: <span className="font-semibold">{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currency}</span>
              </p>
            )}
          </div>

          {/* Destino */}
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Destino
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={destination === "bodega_nextipac"}
                  onChange={() => setDestination("bodega_nextipac")}
                  className="text-purple-600"
                />
                <span className="text-sm">Bodega Nextipac (GDL)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={destination === "directo_cliente"}
                  onChange={() => setDestination("directo_cliente")}
                  className="text-purple-600"
                />
                <span className="text-sm">Directo a Cliente</span>
              </label>
            </div>
            {destination === "directo_cliente" && (
              <Input
                value={destinationDetail}
                onChange={(e) => setDestinationDetail(e.target.value)}
                placeholder="Nombre del cliente"
              />
            )}
          </div>

          {/* Fechas */}
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Fechas estimadas
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Embarque intl.</Label>
                <Input type="date" value={estimatedShipDate} onChange={(e) => setEstimatedShipDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Llegada</Label>
                <Input type="date" value={estimatedArrivalDate} onChange={(e) => setEstimatedArrivalDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* AI notice */}
          <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 text-xs text-purple-600">
            <Sparkles className="h-4 w-4 shrink-0" />
            Datos extraídos con AI — verifica antes de confirmar
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!supplierName.trim() || isSubmitting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSubmitting ? "Creando..." : "Crear Importación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
