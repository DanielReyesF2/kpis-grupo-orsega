-- Script para corregir el área de Thalia
-- Thalia debe estar en Logística de Grupo Orsega (company_id: 2, area_id: 5)

-- 1. Verificar el área actual de Thalia
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
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%')
  AND u.company_id = 2;  -- Grupo Orsega

-- 2. Verificar que exista el área de Logística para Grupo Orsega (area_id: 5)
SELECT 
    a.id,
    a.name,
    a.company_id,
    c.name as company_name
FROM areas a
LEFT JOIN companies c ON a.company_id = c.id
WHERE a.id = 5 AND a.company_id = 2;

-- 3. Si el área 5 no existe, crearla
INSERT INTO areas (id, name, description, company_id) 
VALUES (5, 'Logística', 'Área de Logística para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- 4. CORRECCIÓN: Asignar Thalia a Logística de Grupo Orsega (area_id: 5)
UPDATE users 
SET area_id = 5
WHERE (LOWER(name) LIKE '%thalia%' OR LOWER(name) LIKE '%thalía%' OR LOWER(email) LIKE '%thalia%')
  AND company_id = 2;  -- Grupo Orsega

-- 5. Verificar la corrección
SELECT 
    u.id,
    u.name,
    u.email,
    u.company_id,
    u.area_id,
    c.name as company_name,
    a.name as area_name
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%')
  AND u.company_id = 2;

-- 6. Verificar que Omar esté en Ventas de Grupo Orsega (area_id: 4)
UPDATE users 
SET area_id = 4
WHERE (LOWER(name) LIKE '%omar%' OR LOWER(email) LIKE '%omar%')
  AND company_id = 2;  -- Grupo Orsega

-- 7. Verificar KPIs de Ventas (area_id: 4) y Logística (area_id: 5) para Grupo Orsega
SELECT 
    k.id,
    k.name,
    k.area_id,
    k.company_id,
    a.name as area_name
FROM kpis k
LEFT JOIN areas a ON k.area_id = a.id
WHERE k.company_id = 2  -- Grupo Orsega
  AND k.area_id IN (4, 5)  -- Ventas y Logística
ORDER BY k.area_id, k.name;





