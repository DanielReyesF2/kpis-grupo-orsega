-- Migration: Create client_contact_tracking table for Sales Plan tracking
-- Used to track when sales team contacts clients from the Sales Plan section

CREATE TABLE IF NOT EXISTS client_contact_tracking (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_id INTEGER,
  contacted_by INTEGER REFERENCES users(id),
  contacted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  next_action VARCHAR(255),
  next_action_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by company and client
CREATE INDEX IF NOT EXISTS idx_client_contact_tracking_company ON client_contact_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_client_contact_tracking_client ON client_contact_tracking(company_id, client_name);
CREATE INDEX IF NOT EXISTS idx_client_contact_tracking_date ON client_contact_tracking(contacted_at DESC);
