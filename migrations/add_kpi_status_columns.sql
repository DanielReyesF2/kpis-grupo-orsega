-- Migración para agregar columnas de status y compliance_percentage a las tablas de valores de KPI
-- Ejecutar este script en la base de datos

-- Agregar columnas a kpi_values_dura
ALTER TABLE kpi_values_dura 
ADD COLUMN IF NOT EXISTS compliance_percentage TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS comments TEXT,
ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- Agregar columnas a kpi_values_orsega
ALTER TABLE kpi_values_orsega 
ADD COLUMN IF NOT EXISTS compliance_percentage TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS comments TEXT,
ADD COLUMN IF NOT EXISTS updated_by INTEGER;


