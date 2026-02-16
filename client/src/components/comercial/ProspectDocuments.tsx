import { useState } from "react";
import { formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  FileText,
  File,
  Presentation,
  FileSpreadsheet,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProspectDocuments, useCreateDocument, useDeleteDocument } from "@/hooks/useComercial";

interface ProspectDocumentsProps {
  prospectId: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  contrato: <FileText className="h-5 w-5" />,
  cotizacion: <FileSpreadsheet className="h-5 w-5" />,
  presentacion: <Presentation className="h-5 w-5" />,
  otro: <File className="h-5 w-5" />,
};

const typeLabels: Record<string, string> = {
  contrato: "Contrato",
  cotizacion: "Cotizacion",
  presentacion: "Presentacion",
  otro: "Otro",
};

const typeColors: Record<string, string> = {
  contrato: "bg-purple-100 text-purple-600",
  cotizacion: "bg-green-100 text-green-600",
  presentacion: "bg-blue-100 text-blue-600",
  otro: "bg-gray-100 text-gray-600",
};

export function ProspectDocuments({ prospectId }: ProspectDocumentsProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [newDocument, setNewDocument] = useState({
    name: "",
    type: "otro",
    url: "",
    description: "",
  });

  const { data: documents = [], isLoading } = useProspectDocuments(prospectId);
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();

  const handleCreateDocument = async () => {
    if (!newDocument.name.trim() || !newDocument.url.trim()) {
      toast({
        title: "Error",
        description: "El nombre y URL son requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      await createDocument.mutateAsync({
        prospectId,
        data: {
          name: newDocument.name,
          type: newDocument.type,
          url: newDocument.url,
          description: newDocument.description || undefined,
        },
      });
      setIsDialogOpen(false);
      setNewDocument({ name: "", type: "otro", url: "", description: "" });
      toast({
        title: "Documento agregado",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el documento",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      await deleteDocument.mutateAsync({ prospectId, docId });
      setDeleteConfirm(null);
      toast({
        title: "Documento eliminado",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h4 className="font-medium">Documentos</h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nombre del documento</label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Propuesta comercial Q1 2026"
                  value={newDocument.name}
                  onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select
                  value={newDocument.type}
                  onValueChange={(v) => setNewDocument({ ...newDocument, type: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="cotizacion">Cotizacion</SelectItem>
                    <SelectItem value="presentacion">Presentacion</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">URL del documento</label>
                <Input
                  className="mt-1"
                  placeholder="https://drive.google.com/..."
                  value={newDocument.url}
                  onChange={(e) => setNewDocument({ ...newDocument, url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link a Google Drive, Dropbox, o cualquier URL publica
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Descripcion (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Notas sobre el documento..."
                  value={newDocument.description}
                  onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateDocument} disabled={createDocument.isPending}>
                  {createDocument.isPending ? "Guardando..." : "Agregar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No hay documentos</p>
              <p className="text-sm">Agrega documentos para compartir con el equipo</p>
            </div>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${typeColors[doc.type || "otro"]}`}>
                      {typeIcons[doc.type || "otro"]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{doc.name}</h4>
                        <Badge variant="outline" className="shrink-0">
                          {typeLabels[doc.type || "otro"]}
                        </Badge>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                        <span>
                          {doc.createdAt &&
                            formatDistance(new Date(doc.createdAt), new Date(), {
                              addSuffix: true,
                              locale: es,
                            })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara la referencia al documento. El archivo original no sera
              afectado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteDocument(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
