-- 11_shipment_event.sql
CREATE TABLE IF NOT EXISTS shipment_event (
  id UUID PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pickup','customs','delay','delivery','note')),
  at TIMESTAMP NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  notes TEXT,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_shipment_at ON shipment_event(shipment_id, at DESC);