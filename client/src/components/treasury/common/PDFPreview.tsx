import { FileText, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PDFViewer } from "@/components/treasury/document-viewer/PDFViewer";
import { ImageViewer } from "@/components/treasury/document-viewer/ImageViewer";

interface PDFPreviewProps {
  file: File;
  url?: string;
}

export function PDFPreview({ file, url }: PDFPreviewProps) {
  const isImage = file.type.startsWith("image/");
  const previewUrl = url || URL.createObjectURL(file);

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {isImage ? (
            <ImageIcon className="h-5 w-5 text-primary" />
          ) : (
            <FileText className="h-5 w-5 text-primary" />
          )}
          <p className="font-semibold text-base">{file.name}</p>
        </div>
        <div className="border-2 border-border rounded-lg overflow-hidden h-96">
          {isImage ? (
            <ImageViewer
              imageUrl={previewUrl}
              imageName={file.name}
              className="h-full"
            />
          ) : (
            <PDFViewer
              fileUrl={previewUrl}
              fileName={file.name}
              className="h-full"
            />
          )}
        </div>
      </div>
    </Card>
  );
}

