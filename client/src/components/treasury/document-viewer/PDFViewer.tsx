import { useState } from "react";
import { Download, ExternalLink, FileText, Maximize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  onDownload?: () => void;
  className?: string;
}

export function PDFViewer({ fileUrl, fileName = "documento.pdf", onDownload, className = "" }: PDFViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Construir URL completa si es relativa
  // blob: y data: URLs son absolutas y deben usarse directamente
  const fullUrl = fileUrl.startsWith("http") || fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")
    ? fileUrl
    : `${window.location.origin}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement("a");
      link.href = fullUrl;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(fullUrl, "_blank");
  };

  const viewerContent = (
    <div className={`flex flex-col bg-white rounded-lg border ${className}`}>
      {/* Header con acciones */}
      <div className="flex items-center justify-between p-3 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          <span className="font-medium text-slate-800 truncate max-w-[200px]">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenInNewTab}
            className="h-8 text-slate-700 border-slate-300 hover:bg-slate-100"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Abrir
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={handleDownload}
            className="h-8 bg-emerald-600 hover:bg-emerald-700"
          >
            <Download className="h-4 w-4 mr-1" />
            Descargar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsFullscreen(true)}
            className="h-8 border-slate-300 hover:bg-slate-100"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Visor del PDF usando iframe nativo del navegador */}
      <div className="flex-1 min-h-[400px] bg-slate-100">
        {hasError ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-slate-700 font-medium mb-2">No se puede mostrar la vista previa</p>
            <p className="text-slate-500 text-sm mb-4">Puedes descargar el archivo para verlo</p>
            <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700">
              <Download className="h-4 w-4 mr-2" />
              Descargar {fileName}
            </Button>
          </div>
        ) : (
          <iframe
            src={`${fullUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full min-h-[400px] border-0"
            title={fileName}
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        {viewerContent}
        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[90vh] p-0">
            <DialogHeader className="p-4 border-b bg-slate-50">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                {fileName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 h-full p-4">
              <div className="flex gap-2 mb-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenInNewTab}
                  className="text-slate-700"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir en nueva pestaña
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleDownload}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Descargar
                </Button>
              </div>
              <iframe
                src={`${fullUrl}#toolbar=1&navpanes=0`}
                className="w-full h-[calc(100%-60px)] border rounded-lg"
                title={fileName}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return viewerContent;
}

