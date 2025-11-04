import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PaymentsFlowProps {
  onBack: () => void;
}

export function PaymentsFlow({ onBack }: PaymentsFlowProps) {
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <Button
        onClick={onBack}
        variant="ghost"
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver al inicio
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Lista de Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Lista de pagos - En desarrollo (Fase 7)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

