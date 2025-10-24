import { AppLayout } from '@/components/layout/AppLayout';
import { ShipmentTrackerSimple } from '@/components/shipments/ShipmentTrackerSimple';

export default function Shipments() {
  return (
    <AppLayout title="Trazabilidad de Envíos">
      <ShipmentTrackerSimple />
    </AppLayout>
  );
}