-- ============================================
-- MIGRACIÓN: Agregar columna payment_date a scheduled_payments
-- ============================================
-- Fecha: 2025-01-XX
-- Descripción: Agregar campo para fecha de pago programada (obligatorio para facturas manuales)

BEGIN;

-- Agregar payment_date (fecha de pago programada)
-- NULL para registros existentes y registros de Idrall
-- Obligatorio para facturas manuales creadas desde el modal de verificación
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

COMMIT;


