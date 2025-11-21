-- Script para verificar y corregir asignaciones de áreas a usuarios
-- Ejecutar en la base de datos para verificar el estado actual

-- 1. Verificar usuarios y sus áreas actuales
SELECT 
    u.id,
    u.name,
    u.email,
    u.company_id,
    u.area_id,
    c.name as company_name,
    a.name as area_name,
    a.company_id as area_company_id
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE LOWER(u.name) LIKE '%omar%' 
   OR LOWER(u.name) LIKE '%thalia%' 
   OR LOWER(u.name) LIKE '%thalía%'
ORDER BY u.name;

-- 2. Verificar que existan las áreas correctas para Grupo Orsega
SELECT 
    a.id,
    a.name,
    a.company_id,
    c.name as company_name
FROM areas a
LEFT JOIN companies c ON a.company_id = c.id
WHERE c.id = 2  -- Grupo Orsega
ORDER BY a.id;

-- 3. CORRECCIÓN: Asignar áreas correctas a usuarios de Grupo Orsega
-- Omar Navarro -> Ventas (area_id: 4) de Grupo Orsega (company_id: 2)
UPDATE users 
SET area_id = 4
WHERE (LOWER(name) LIKE '%omar%' OR LOWER(email) LIKE '%omar%')
  AND company_id = 2;

-- Thalia/Thalía -> Logística (area_id: 5) de Grupo Orsega (company_id: 2)
UPDATE users 
SET area_id = 5
WHERE (LOWER(name) LIKE '%thalia%' OR LOWER(name) LIKE '%thalía%' OR LOWER(email) LIKE '%thalia%')
  AND company_id = 2;

-- 4. Verificar KPIs y sus áreas asignadas para Grupo Orsega
SELECT 
    k.id,
    k.name,
    k.area_id,
    k.company_id,
    a.name as area_name,
    a.company_id as area_company_id
FROM kpis k
LEFT JOIN areas a ON k.area_id = a.id
WHERE k.company_id = 2  -- Grupo Orsega
ORDER BY k.area_id, k.name;

-- 5. Verificar que los KPIs de Ventas estén en area_id 4 (Ventas Grupo Orsega)
-- y los KPIs de Logística estén en area_id 5 (Logística Grupo Orsega)
-- Si hay KPIs mal asignados, se deben corregir manualmente según corresponda




