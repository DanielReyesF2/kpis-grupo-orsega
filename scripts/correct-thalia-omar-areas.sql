-- =====================================================
-- CORRECCION DE AREAS PARA THALIA Y OMAR (GRUPO ORSEGA)
-- =====================================================

-- IMPORTANTE: 
-- - Thalia debe estar en Logistica de Grupo Orsega (area_id: 5, company_id: 2)
-- - Omar debe estar en Ventas de Grupo Orsega (area_id: 4, company_id: 2)

-- 1. Verificar estado actual
SELECT 
    'ESTADO ACTUAL' as paso,
    u.id,
    u.name,
    u.email,
    u.company_id as user_company_id,
    u.area_id as user_area_id,
    c.name as company_name,
    a.name as area_name,
    a.company_id as area_company_id,
    CASE 
        WHEN u.company_id = 2 AND u.area_id = 5 AND u.name ILIKE '%thalia%' THEN 'CORRECTO - Logistica Grupo Orsega'
        WHEN u.company_id = 2 AND u.area_id = 4 AND u.name ILIKE '%omar%' THEN 'CORRECTO - Ventas Grupo Orsega'
        ELSE 'INCORRECTO'
    END as estado
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%'
       OR LOWER(u.name) LIKE '%omar%' OR LOWER(u.email) LIKE '%omar%')
  AND u.company_id = 2
ORDER BY u.name;

-- 2. Verificar que existan las areas correctas para Grupo Orsega
SELECT 
    'AREAS DE GRUPO ORSEGA' as paso,
    a.id,
    a.name,
    a.company_id,
    c.name as company_name
FROM areas a
LEFT JOIN companies c ON a.company_id = c.id
WHERE a.company_id = 2
ORDER BY a.id;

-- 3. Si el area 5 (Logistica Grupo Orsega) no existe, crearla
INSERT INTO areas (id, name, description, company_id) 
VALUES (5, 'Logistica', 'Area de Logistica para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- Si el area 4 (Ventas Grupo Orsega) no existe, crearla
INSERT INTO areas (id, name, description, company_id) 
VALUES (4, 'Ventas', 'Area de Ventas para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- 4. CORRECCION: Asignar Thalia a Logistica de Grupo Orsega (area_id: 5)
UPDATE users 
SET area_id = 5
WHERE (LOWER(name) LIKE '%thalia%' OR LOWER(name) LIKE '%thalía%' OR LOWER(email) LIKE '%thalia%')
  AND company_id = 2;

-- 5. CORRECCION: Asignar Omar a Ventas de Grupo Orsega (area_id: 4)
UPDATE users 
SET area_id = 4
WHERE (LOWER(name) LIKE '%omar%' OR LOWER(email) LIKE '%omar%')
  AND company_id = 2;

-- 6. Verificar la correccion final
SELECT 
    'ESTADO FINAL' as paso,
    u.id,
    u.name,
    u.email,
    u.company_id,
    u.area_id,
    c.name as company_name,
    a.name as area_name,
    CASE 
        WHEN u.company_id = 2 AND u.area_id = 5 AND u.name ILIKE '%thalia%' THEN 'CORRECTO'
        WHEN u.company_id = 2 AND u.area_id = 4 AND u.name ILIKE '%omar%' THEN 'CORRECTO'
        ELSE 'VERIFICAR'
    END as estado
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%'
       OR LOWER(u.name) LIKE '%omar%' OR LOWER(u.email) LIKE '%omar%')
  AND u.company_id = 2
ORDER BY u.name;

-- 7. Verificar KPIs asignados a cada area de Grupo Orsega
SELECT 
    'KPIs POR AREA' as paso,
    k.area_id,
    a.name as area_name,
    COUNT(*) as total_kpis,
    STRING_AGG(k.name, ', ' ORDER BY k.name) as kpi_names
FROM kpis k
LEFT JOIN areas a ON k.area_id = a.id
WHERE k.company_id = 2
  AND k.area_id IN (4, 5)
GROUP BY k.area_id, a.name
ORDER BY k.area_id;

