-- CORRECCION SIMPLE: Asignar areas correctas a Thalia y Omar

-- 1. Asegurar que exista el area 5 (Logistica Grupo Orsega)
INSERT INTO areas (id, name, description, company_id) 
VALUES (5, 'Logistica', 'Area de Logistica para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- 2. Asegurar que exista el area 4 (Ventas Grupo Orsega)
INSERT INTO areas (id, name, description, company_id) 
VALUES (4, 'Ventas', 'Area de Ventas para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- 3. CORRECCION: Asignar Thalia a Logistica de Grupo Orsega (area_id: 5)
UPDATE users 
SET area_id = 5
WHERE (LOWER(name) LIKE '%thalia%' OR LOWER(name) LIKE '%thalía%' OR LOWER(email) LIKE '%thalia%')
  AND company_id = 2;

-- 4. CORRECCION: Asignar Omar a Ventas de Grupo Orsega (area_id: 4)
UPDATE users 
SET area_id = 4
WHERE (LOWER(name) LIKE '%omar%' OR LOWER(email) LIKE '%omar%')
  AND company_id = 2;

-- 5. Verificar resultado
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
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%'
       OR LOWER(u.name) LIKE '%omar%' OR LOWER(u.email) LIKE '%omar%')
  AND u.company_id = 2
ORDER BY u.name;


