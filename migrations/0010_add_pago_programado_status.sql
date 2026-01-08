-- Agregar nuevo valor 'pago_programado' al enum voucher_status
-- Este valor es el estado inicial cuando se sube una factura (antes de subir comprobante de pago)
-- Nota: IF NOT EXISTS no es soportado en todas las versiones de PostgreSQL para ADD VALUE
-- Por eso usamos DO block para verificar primero
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pago_programado' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'voucher_status')
    ) THEN
        ALTER TYPE "public"."voucher_status" ADD VALUE 'pago_programado' BEFORE 'factura_pagada';
    END IF;
END
$$;

