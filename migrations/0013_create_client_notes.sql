-- Tabla para notas y contexto de clientes
-- Ejemplo: "Dura Chemicals - Solo compra urgencias/devoluciones de importación"
CREATE TABLE IF NOT EXISTS client_notes (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_id INTEGER,
  note TEXT NOT NULL,
  category VARCHAR(50),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_client_notes_company ON client_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(company_id, client_name);
CREATE INDEX IF NOT EXISTS idx_client_notes_active ON client_notes(company_id, is_active);
