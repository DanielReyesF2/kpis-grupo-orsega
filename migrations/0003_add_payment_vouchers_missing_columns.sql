-- ============================================
-- MIGRACIÓN: Agregar columnas faltantes a payment_vouchers
-- ============================================
-- Fecha: 2025-11-18
-- Ticket: Fix error "column payer_company_id does not exist"
-- Descripción: Sincronizar schema de payment_vouchers con código actual

-- IMPORTANTE: Esta migración es SAFE para producción
-- - Todas las columnas son NULLABLE o tienen DEFAULT
-- - No se eliminan columnas existentes
-- - No se modifican datos existentes
-- - Compatible con registros existentes
-- - Ejecutar statements individualmente si es necesario

-- 1. Agregar payer_company_id (Empresa pagadora: Orsega/Dura)
-- DEFAULT al company_id existente para registros existentes
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS payer_company_id INTEGER;

-- Actualizar registros existentes para que payer_company_id = company_id
UPDATE payment_vouchers
SET payer_company_id = company_id
WHERE payer_company_id IS NULL;

-- Ahora hacer NOT NULL después de actualizar
-- Primero verificar que todos los registros tienen un valor
-- Si hay NULLs, esto fallará, así que primero los actualizamos arriba
ALTER TABLE payment_vouchers
ALTER COLUMN payer_company_id SET NOT NULL;

-- 2. Agregar extracted_origin_account (Cuenta origen)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS extracted_origin_account TEXT;

-- 3. Agregar extracted_destination_account (Cuenta destino)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS extracted_destination_account TEXT;

-- 4. Agregar extracted_tracking_key (Clave de rastreo SPEI)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS extracted_tracking_key TEXT;

-- 5. Agregar extracted_beneficiary_name (Nombre del beneficiario)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS extracted_beneficiary_name TEXT;

-- 6. Agregar notify (Configuración de envío de correo)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS notify BOOLEAN DEFAULT false;

-- 7. Agregar email_to (Emails principales)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS email_to TEXT[];

-- 8. Agregar email_cc (Emails en copia)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS email_cc TEXT[];

-- 9. Agregar email_message (Mensaje personalizado para el correo)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS email_message TEXT;

-- 10. Agregar linked_invoice_id (ID de factura asociada)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS linked_invoice_id INTEGER;

-- 11. Agregar linked_invoice_uuid (UUID de factura asociada)
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS linked_invoice_uuid TEXT;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_vouchers'
AND column_name IN (
    'payer_company_id',
    'extracted_origin_account',
    'extracted_destination_account',
    'extracted_tracking_key',
    'extracted_beneficiary_name',
    'notify',
    'email_to',
    'email_cc',
    'email_message',
    'linked_invoice_id',
    'linked_invoice_uuid'
)
ORDER BY column_name;

