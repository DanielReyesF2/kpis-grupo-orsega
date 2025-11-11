-- VERIFICAR Y CORREGIR ASIGNACIONES DE USUARIOS Y KPIs

-- 1. Verificar usuarios Thalia y Omar
SELECT 
    'USUARIOS' as tipo,
    u.id,
    u.name,
    u.email,
    u.company_id,
    u.area_id,
    c.name as company_name,
    a.name as area_name,
    a.company_id as area_company_id,
    CASE 
        WHEN u.name ILIKE '%thalia%' AND u.company_id = 2 AND u.area_id = 5 THEN 'OK - Thalia en Logistica Grupo Orsega'
        WHEN u.name ILIKE '%omar%' AND u.company_id = 2 AND u.area_id = 4 THEN 'OK - Omar en Ventas Grupo Orsega'
        WHEN u.name ILIKE '%thalia%' THEN 'ERROR - Thalia debe estar en area_id 5'
        WHEN u.name ILIKE '%omar%' THEN 'ERROR - Omar debe estar en area_id 4'
        ELSE 'VERIFICAR'
    END as estado
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%'
       OR LOWER(u.name) LIKE '%omar%' OR LOWER(u.email) LIKE '%omar%')
  AND u.company_id = 2
ORDER BY u.name;

-- 2. CORRECCION: Asignar Thalia a area_id 5 (Logistica Grupo Orsega)
UPDATE users 
SET area_id = 5
WHERE (LOWER(name) LIKE '%thalia%' OR LOWER(name) LIKE '%thalía%' OR LOWER(email) LIKE '%thalia%')
  AND company_id = 2;

-- 3. CORRECCION: Asignar Omar a area_id 4 (Ventas Grupo Orsega)
UPDATE users 
SET area_id = 4
WHERE (LOWER(name) LIKE '%omar%' OR LOWER(email) LIKE '%omar%')
  AND company_id = 2;

-- 4. Verificar KPIs de Ventas (area_id: 4) para Grupo Orsega
SELECT 
    'KPIs VENTAS' as tipo,
    k.id,
    k.name,
    k.area_id,
    k.company_id,
    a.name as area_name
FROM kpis k
LEFT JOIN areas a ON k.area_id = a.id
WHERE k.company_id = 2
  AND k.area_id = 4
ORDER BY k.name;

-- 5. Verificar KPIs de Logistica (area_id: 5) para Grupo Orsega
SELECT 
    'KPIs LOGISTICA' as tipo,
    k.id,
    k.name,
    k.area_id,
    k.company_id,
    a.name as area_name
FROM kpis k
LEFT JOIN areas a ON k.area_id = a.id
WHERE k.company_id = 2
  AND k.area_id = 5
ORDER BY k.name;

-- 6. Verificar resultado final de usuarios
SELECT 
    'RESULTADO FINAL' as tipo,
    u.id,
    u.name,
    u.email,
    u.company_id,
    u.area_id,
    c.name as company_name,
    a.name as area_name,
    (SELECT COUNT(*) FROM kpis WHERE company_id = u.company_id AND area_id = u.area_id) as total_kpis_en_area
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE (LOWER(u.name) LIKE '%thalia%' OR LOWER(u.name) LIKE '%thalía%' OR LOWER(u.email) LIKE '%thalia%'
       OR LOWER(u.name) LIKE '%omar%' OR LOWER(u.email) LIKE '%omar%')
  AND u.company_id = 2
ORDER BY u.name;


