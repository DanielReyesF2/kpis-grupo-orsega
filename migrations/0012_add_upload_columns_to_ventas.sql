-- ============================================
-- MIGRACIÓN 0012: Agregar columnas de soporte para uploads a ventas
-- ============================================
-- Agrega columnas que los upload handlers necesitan para escribir
-- directamente a ventas (en lugar de sales_data)
-- ============================================

BEGIN;

-- Columnas de referencia (FK a clients y products)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS product_id INTEGER;

-- Columna para tracking de uploads
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS upload_id INTEGER;

-- Submodulo (DI o GO) para distinguir origen
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS submodulo VARCHAR(10);

-- Utilidad bruta (usado por migration 010 y dashboard)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utilidad_bruta DECIMAL(15, 2);

-- Campos IDRALL-specific
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS status VARCHAR(20);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS lote VARCHAR(100);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS costo_unitario DECIMAL(15, 4);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utilidad_perdida DECIMAL(15, 4);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utilidad_con_gastos DECIMAL(15, 4);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utilidad_porcentaje DECIMAL(8, 4);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_cambio_costo DECIMAL(10, 4);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS folio_numero INTEGER;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS folio_secuencia INTEGER;

-- Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_ventas_client_id ON ventas(client_id);
CREATE INDEX IF NOT EXISTS idx_ventas_product_id ON ventas(product_id);
CREATE INDEX IF NOT EXISTS idx_ventas_upload_id ON ventas(upload_id);
CREATE INDEX IF NOT EXISTS idx_ventas_submodulo ON ventas(company_id, submodulo);

COMMIT;

-- Verificar
SELECT 'Migración 0012 completada' as status,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ventas') as total_columnas;
