-- Script para corregir nombres de productos en base de datos de PRODUCCIÓN
-- Ejecutar en: Database → Production Database

-- Actualizar productos de DURA: DUROCK → DUROCT
UPDATE shipments 
SET products = REPLACE(products::text, 'DUROCK', 'DUROCT')::jsonb
WHERE products::text LIKE '%DUROCK%';

-- Actualizar productos de Grupo Orsega: NONCAT → MONCAT  
UPDATE shipments 
SET products = REPLACE(products::text, 'NONCAT', 'MONCAT')::jsonb
WHERE products::text LIKE '%NONCAT%';

-- Verificar cambios
SELECT id, guide_number, products 
FROM shipments 
WHERE products::text LIKE '%DUROCT%' OR products::text LIKE '%MONCAT%'
LIMIT 10;
