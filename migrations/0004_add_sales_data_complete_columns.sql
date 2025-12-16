-- ============================================
-- MIGRACIÓN: Agregar columnas completas del Excel a sales_data
-- ============================================
-- Fecha: 2025-01-XX
-- Descripción: Agregar todas las columnas del Excel de ventas para guardar información completa
-- Columnas del Excel: PRECIO UNITARIO, IMPORTE, VENTA 2024, VENTA 2025

-- IMPORTANTE: Esta migración es SAFE para producción
-- - Todas las columnas son NULLABLE
-- - No se eliminan columnas existentes
-- - No se modifican datos existentes
-- - Compatible con registros existentes

BEGIN;

-- 1. Agregar unit_price (PRECIO UNITARIO del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(15, 2);

-- 2. Agregar total_amount (IMPORTE del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2);

-- 3. Agregar quantity_2024 (VENTA 2024 del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS quantity_2024 DECIMAL(15, 2);

-- 4. Agregar quantity_2025 (VENTA 2025 del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS quantity_2025 DECIMAL(15, 2);

-- 5. Agregar folio (Folio2 del Excel - aunque ya tenemos invoice_number, guardamos ambos por si acaso)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS folio VARCHAR(100);

-- Crear índices para mejorar búsquedas por año
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_2024 ON sales_data(quantity_2024) WHERE quantity_2024 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_2025 ON sales_data(quantity_2025) WHERE quantity_2025 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_total_amount ON sales_data(total_amount) WHERE total_amount IS NOT NULL;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ejecuta esto después para verificar que las columnas se agregaron:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'sales_data' 
-- AND column_name IN ('unit_price', 'total_amount', 'quantity_2024', 'quantity_2025', 'folio')
-- ORDER BY column_name;












