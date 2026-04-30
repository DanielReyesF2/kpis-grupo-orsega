-- Migration 0014: Create Import Orders module tables
-- Module: Importaciones (Logística)

-- Enum types
DO $$ BEGIN
  CREATE TYPE import_order_status AS ENUM (
    'oc_created', 'in_transit_to_customs', 'in_customs',
    'in_yard', 'in_transit_to_warehouse', 'in_warehouse', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE import_checklist_type AS ENUM ('check', 'file');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main table: import_orders
CREATE TABLE IF NOT EXISTS import_orders (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  reference VARCHAR(30) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'oc_created'
    CHECK (status IN ('oc_created', 'in_transit_to_customs', 'in_customs', 'in_yard', 'in_transit_to_warehouse', 'in_warehouse', 'cancelled')),

  -- OC document
  oc_document_key TEXT,
  oc_document_name VARCHAR(255),

  -- Supplier
  supplier_name VARCHAR(200) NOT NULL,
  supplier_country VARCHAR(100),

  -- OC data
  incoterm VARCHAR(20),
  currency VARCHAR(10) DEFAULT 'USD',
  total_value NUMERIC(14,2),
  purchase_order_number VARCHAR(100),

  -- Destination
  destination VARCHAR(50) DEFAULT 'bodega_nextipac',
  destination_detail VARCHAR(200),

  -- Estimated dates
  estimated_ship_date DATE,
  estimated_arrival_date DATE,
  estimated_customs_clear_date DATE,
  estimated_warehouse_date DATE,

  -- Actual dates
  actual_ship_date DATE,
  actual_arrival_date DATE,
  actual_customs_clear_date DATE,
  actual_warehouse_date DATE,

  -- Shipping data
  vessel_name VARCHAR(200),
  container_number VARCHAR(50),
  bill_of_lading_number VARCHAR(100),

  -- Customs data
  pedimento_number VARCHAR(100),
  customs_broker VARCHAR(200),

  -- Local transport
  local_carrier VARCHAR(200),

  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS import_order_items (
  id SERIAL PRIMARY KEY,
  import_order_id INTEGER NOT NULL REFERENCES import_orders(id),
  product_name VARCHAR(300) NOT NULL,
  quantity NUMERIC(14,2),
  unit VARCHAR(20),
  unit_price NUMERIC(14,4),
  description TEXT
);

-- Checklist items table
CREATE TABLE IF NOT EXISTS import_order_checklist_items (
  id SERIAL PRIMARY KEY,
  import_order_id INTEGER NOT NULL REFERENCES import_orders(id),
  stage VARCHAR(30) NOT NULL,
  label VARCHAR(200) NOT NULL,
  type VARCHAR(10) NOT NULL DEFAULT 'check' CHECK (type IN ('check', 'file')),
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP,
  completed_by INTEGER,

  file_key TEXT,
  file_name VARCHAR(255)
);

-- Activity log table
CREATE TABLE IF NOT EXISTS import_order_activity_log (
  id SERIAL PRIMARY KEY,
  import_order_id INTEGER NOT NULL REFERENCES import_orders(id),
  action VARCHAR(100) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  details TEXT,
  user_id INTEGER,
  user_name VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_orders_company ON import_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_import_orders_status ON import_orders(status);
CREATE INDEX IF NOT EXISTS idx_import_orders_company_status ON import_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_import_order_items_order ON import_order_items(import_order_id);
CREATE INDEX IF NOT EXISTS idx_import_order_checklist_order ON import_order_checklist_items(import_order_id);
CREATE INDEX IF NOT EXISTS idx_import_order_checklist_stage ON import_order_checklist_items(import_order_id, stage);
CREATE INDEX IF NOT EXISTS idx_import_order_activity_order ON import_order_activity_log(import_order_id);
