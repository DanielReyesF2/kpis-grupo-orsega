-- 01_client.sql
CREATE TABLE IF NOT EXISTS client (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  rfc TEXT,
  email TEXT,
  phone TEXT,
  billing_addr TEXT,
  shipping_addr TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);