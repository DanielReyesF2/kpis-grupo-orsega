import { useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

interface ImageViewerProps {
  imageUrl: string;
  imageName?: string;
  images?: Array<{ original: string; thumbnail: string; description?: string }>;
  onDownload?: () => void;
  className?: string;
}

export function ImageViewer({
  imageUrl,
  imageName,
  images,
  onDownload,
  className = "",
}: ImageViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  // Si hay múltiples imágenes, usar galería
  if (images && images.length > 1) {
    return (
      <div className={className}>
        <ImageGallery
          items={images}
          showPlayButton={false}
          showFullscreenButton={true}
          showThumbnails={true}
          thumbnailPosition="bottom"
          additionalClass="image-gallery-custom"
        />
      </div>
    );
  }

  // Vista simple de una imagen con controles
  const imageContent = (
    <div className={`relative w-full h-full ${className}`}>
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="h-8"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="h-8"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRotate}
          className="h-8"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        {onDownload && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onDownload}
            className="h-8"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {zoom !== 1 || rotation !== 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReset}
            className="h-8"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center justify-center w-full h-full overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
        <img
          src={imageUrl}
          alt={imageName || "Imagen"}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        />
      </div>
      <div className="absolute bottom-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          {imageContent}
        </DialogContent>
      </Dialog>
    );
  }

  return imageContent;
}

