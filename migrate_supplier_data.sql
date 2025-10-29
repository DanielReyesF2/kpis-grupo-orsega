-- ============================================
-- MIGRACIÓN: Migrar datos existentes de supplierName a suppliers
-- ============================================
-- Fecha: 2025-01-28
-- Descripción: Migrar datos existentes de scheduled_payments.supplier_name a la nueva tabla suppliers
-- y actualizar las referencias

-- Paso 1: Crear suppliers únicos basados en supplier_name existente
INSERT INTO suppliers (name, short_name, email, location, requires_rep, rep_frequency, company_id, is_active)
SELECT DISTINCT
  sp.supplier_name as name,
  LEFT(sp.supplier_name, 20) as short_name, -- Usar primeros 20 caracteres como nombre corto
  NULL as email, -- No tenemos email en los datos existentes
  'NAC' as location, -- Asumir nacional por defecto
  TRUE as requires_rep, -- Asumir que requieren REP
  7 as rep_frequency, -- Frecuencia por defecto de 7 días
  sp.company_id,
  TRUE as is_active
FROM scheduled_payments sp
WHERE sp.supplier_name IS NOT NULL 
  AND sp.supplier_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s 
    WHERE s.name = sp.supplier_name 
    AND s.company_id = sp.company_id
  );

-- Paso 2: Actualizar scheduled_payments con supplier_id
UPDATE scheduled_payments 
SET supplier_id = s.id
FROM suppliers s
WHERE scheduled_payments.supplier_name = s.name
  AND scheduled_payments.company_id = s.company_id
  AND scheduled_payments.supplier_id IS NULL;

-- Paso 3: Verificar la migración
SELECT 
  'Antes de migración' as estado,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 1 END) as payments_with_supplier_name,
  COUNT(CASE WHEN supplier_id IS NOT NULL THEN 1 END) as payments_with_supplier_id
FROM scheduled_payments

UNION ALL

SELECT 
  'Después de migración' as estado,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 1 END) as payments_with_supplier_name,
  COUNT(CASE WHEN supplier_id IS NOT NULL THEN 1 END) as payments_with_supplier_id
FROM scheduled_payments;

-- Paso 4: Mostrar suppliers creados durante la migración
SELECT 
  s.id,
  s.name,
  s.short_name,
  s.company_id,
  c.name as company_name,
  COUNT(sp.id) as payments_count
FROM suppliers s
LEFT JOIN companies c ON s.company_id = c.id
LEFT JOIN scheduled_payments sp ON s.id = sp.supplier_id
GROUP BY s.id, s.name, s.short_name, s.company_id, c.name
ORDER BY s.company_id, s.name;

-- Paso 5: Verificar que no hay pagos sin supplier_id cuando deberían tenerlo
SELECT 
  sp.id,
  sp.supplier_name,
  sp.company_id,
  sp.amount,
  sp.due_date,
  sp.status
FROM scheduled_payments sp
WHERE sp.supplier_name IS NOT NULL 
  AND sp.supplier_name != ''
  AND sp.supplier_id IS NULL
ORDER BY sp.company_id, sp.supplier_name;

-- Comentario: Si hay registros en el paso 5, significa que algunos supplier_name no se pudieron mapear
-- Esto puede ocurrir si hay diferencias en los nombres o caracteres especiales
