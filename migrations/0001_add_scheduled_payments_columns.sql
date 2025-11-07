-- ============================================
-- MIGRACIÓN: Agregar columnas faltantes a scheduled_payments
-- ============================================
-- Fecha: 2025-11-07
-- Ticket: Fix error "column source_type does not exist"
-- Descripción: Sincronizar schema de scheduled_payments con código actual

-- IMPORTANTE: Esta migración es SAFE para producción
-- - Todas las columnas son NULLABLE o tienen DEFAULT
-- - No se eliminan columnas existentes
-- - No se modifican datos existentes
-- - Compatible con registros existentes

BEGIN;

-- 1. Agregar supplier_id (FK a suppliers)
-- Compatible con supplier_name existente
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id);

-- 2. Agregar source_type (origen del pago: 'idrall' | 'manual')
-- DEFAULT 'manual' para registros existentes
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- 3. Agregar hydral_file_url (URL archivo Idrall)
-- NULL para registros manuales
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS hydral_file_url TEXT;

-- 4. Agregar hydral_file_name (nombre archivo Idrall)
-- NULL para registros manuales
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS hydral_file_name TEXT;

-- 5. Agregar approved_at (timestamp de aprobación)
-- NULL hasta que sea aprobado
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- 6. Agregar approved_by (user_id que aprobó)
-- NULL hasta que sea aprobado
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS approved_by INTEGER;

-- 7. Agregar payment_scheduled_at (fecha programada de pago)
-- NULL hasta que se programe
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS payment_scheduled_at TIMESTAMP;

-- 8. Agregar voucher_id (FK a payment_vouchers)
-- NULL hasta que se suba comprobante
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS voucher_id INTEGER REFERENCES payment_vouchers(id);

-- 9. Actualizar default de status para nuevos registros
-- Nota: No afecta registros existentes
ALTER TABLE scheduled_payments
ALTER COLUMN status SET DEFAULT 'idrall_imported';

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_supplier_id ON scheduled_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_source_type ON scheduled_payments(source_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_voucher_id ON scheduled_payments(voucher_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due_date ON scheduled_payments(due_date);

-- Comentarios para documentar los cambios
COMMENT ON COLUMN scheduled_payments.supplier_id IS 'FK a tabla suppliers - permite asociar con proveedor estructurado';
COMMENT ON COLUMN scheduled_payments.source_type IS 'Origen del registro: idrall (importado) o manual (creado manualmente)';
COMMENT ON COLUMN scheduled_payments.hydral_file_url IS 'URL del archivo original de Idrall (columna mantiene nombre hydral por compatibilidad)';
COMMENT ON COLUMN scheduled_payments.hydral_file_name IS 'Nombre del archivo de Idrall (columna mantiene nombre hydral por compatibilidad)';
COMMENT ON COLUMN scheduled_payments.approved_at IS 'Timestamp cuando el pago fue aprobado';
COMMENT ON COLUMN scheduled_payments.approved_by IS 'User ID que aprobó el pago';
COMMENT ON COLUMN scheduled_payments.payment_scheduled_at IS 'Fecha programada para realizar el pago';
COMMENT ON COLUMN scheduled_payments.voucher_id IS 'FK a payment_vouchers - comprobante de pago asociado';

COMMIT;

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- Ejecuta estos queries después de aplicar la migración:

-- 1. Verificar que todas las columnas existen:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'scheduled_payments'
-- ORDER BY ordinal_position;

-- 2. Contar registros existentes (deben permanecer igual):
-- SELECT COUNT(*) FROM scheduled_payments;

-- 3. Verificar que registros existentes tienen source_type='manual':
-- SELECT id, supplier_name, source_type, status
-- FROM scheduled_payments
-- LIMIT 10;
