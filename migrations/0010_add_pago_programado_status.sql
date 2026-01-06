-- Agregar nuevo valor 'pago_programado' al enum voucher_status
-- Este valor es el estado inicial cuando se sube una factura (antes de subir comprobante de pago)
ALTER TYPE "public"."voucher_status" ADD VALUE IF NOT EXISTS 'pago_programado' BEFORE 'factura_pagada';

-- Agregar columna supplier_id a payment_vouchers (opcional, para rastrear el proveedor)
ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "supplier_id" integer;

