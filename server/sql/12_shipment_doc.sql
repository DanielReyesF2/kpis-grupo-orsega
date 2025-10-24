-- 12_shipment_doc.sql
CREATE TABLE IF NOT EXISTS shipment_doc (
  id UUID PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bl','factura','foto','otro')),
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  uploaded_by TEXT
);