import { FileText, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

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
        <div className="border-2 border-border rounded-lg overflow-hidden">
          {isImage ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="w-full h-auto max-h-96 object-contain"
            />
          ) : (
            <iframe
              src={previewUrl}
              className="w-full h-96"
              title={file.name}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

