-- 04_provider_treasury_fields.sql
-- Add treasury-related fields to the existing provider table for REP (Recordatorios de Pago)

ALTER TABLE provider 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id),
ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS reminder_email TEXT,
ADD COLUMN IF NOT EXISTS short_name TEXT, -- Nombre corto del proveedor
ADD COLUMN IF NOT EXISTS location TEXT, -- NAC (Nacional) o EXT (Exterior)
ADD COLUMN IF NOT EXISTS requires_rep BOOLEAN DEFAULT TRUE, -- REP: Si requiere recordatorios
ADD COLUMN IF NOT EXISTS rep_frequency INTEGER DEFAULT 7; -- Frecuencia de recordatorio REP en días
