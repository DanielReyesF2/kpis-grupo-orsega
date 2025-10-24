-- 10_shipment.sql
CREATE TABLE IF NOT EXISTS shipment (
  id UUID PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES client(id),
  provider_id UUID REFERENCES provider(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  incoterm TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente','asignando_transporte','confirmado','en_camino','retenido','entregado','cerrado')),
  etd TIMESTAMP,
  eta TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipment_client ON shipment(client_id);
CREATE INDEX IF NOT EXISTS idx_shipment_provider ON shipment(provider_id);
CREATE INDEX IF NOT EXISTS idx_shipment_status ON shipment(status);