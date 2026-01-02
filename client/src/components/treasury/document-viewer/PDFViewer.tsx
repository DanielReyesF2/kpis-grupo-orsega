import { useState, useRef } from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { searchPlugin } from "@react-pdf-viewer/search";
import type { RenderViewer } from "@react-pdf-viewer/core";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  onDownload?: () => void;
  className?: string;
}

export function PDFViewer({ fileUrl, fileName, onDownload, className = "" }: PDFViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Plugins
  const zoomPluginInstance = zoomPlugin();
  const { ZoomInButton, ZoomOutButton, ZoomPopover } = zoomPluginInstance;

  const searchPluginInstance = searchPlugin();
  const { ShowSearchPopover } = searchPluginInstance;

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      defaultTabs[0], // Thumbnail tab
      defaultTabs[1], // Bookmark tab
    ],
  });

  const renderViewer: RenderViewer = (props) => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <ZoomOutButton />
            <ZoomPopover />
            <ZoomInButton />
            <ShowSearchPopover />
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <Button
                size="sm"
                variant="outline"
                onClick={onDownload}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {props.canvasLayer.children}
          {props.annotationLayer.children}
          {props.textLayer.children}
        </div>
      </div>
    );
  };

  const viewerContent = (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={fileUrl}
          plugins={[
            defaultLayoutPluginInstance,
            zoomPluginInstance,
            searchPluginInstance,
          ]}
          renderViewer={renderViewer}
        />
      </Worker>
    </div>
  );

  if (isFullscreen) {
    return (
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="w-full h-full">{viewerContent}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return viewerContent;
}

