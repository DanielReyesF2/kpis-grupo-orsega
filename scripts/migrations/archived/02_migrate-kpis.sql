-- ============================================================
-- SCRIPT DE MIGRACIÓN: kpis_dura + kpis_orsega -> kpis
-- ============================================================
-- IMPORTANTE: 
-- 1. Ejecutar DESPUÉS de 01_analyze-kpi-tables.ts
-- 2. Verificar resultados entre pasos
-- 3. Hacer ROLLBACK si hay problemas

BEGIN;

-- Paso 1: Crear tabla de mapeo (si no existe)
CREATE TABLE IF NOT EXISTS kpi_migration_map (
  old_id INTEGER NOT NULL,
  new_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  old_table TEXT NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (old_id, old_table)
);

-- Paso 2: Migrar kpis_dura -> kpis
INSERT INTO kpis (name, description, area_id, company_id, unit, target, frequency, calculation_method, responsible)
SELECT 
  kd.kpi_name,
  kd.description,
  COALESCE(a.id, 1) as area_id, -- Fallback a área id 1 si no se encuentra
  1 as company_id,
  COALESCE(kd.unit, 'unidades') as unit,
  COALESCE(kd.goal, '0') as target,
  COALESCE(kd.frequency, 'monthly') as frequency,
  kd.calculation_method,
  kd.responsible
FROM kpis_dura kd
LEFT JOIN areas a ON LOWER(a.name) = LOWER(kd.area) AND a.company_id = 1
WHERE NOT EXISTS (
  SELECT 1 FROM kpis k 
  WHERE LOWER(k.name) = LOWER(kd.kpi_name) 
  AND k.company_id = 1
)
ON CONFLICT DO NOTHING;

-- Paso 3: Guardar mapeos para kpis_dura
INSERT INTO kpi_migration_map (old_id, new_id, company_id, old_table)
SELECT kd.id, k.id, 1, 'kpis_dura'
FROM kpis_dura kd
JOIN kpis k ON LOWER(k.name) = LOWER(kd.kpi_name) AND k.company_id = 1
ON CONFLICT DO NOTHING;

-- Paso 4: Migrar kpis_orsega -> kpis
INSERT INTO kpis (name, description, area_id, company_id, unit, target, frequency, calculation_method, responsible)
SELECT 
  ko.kpi_name,
  ko.description,
  COALESCE(a.id, 2) as area_id, -- Fallback a área id 2 si no se encuentra
  2 as company_id,
  COALESCE(ko.unit, 'unidades') as unit,
  COALESCE(ko.goal, '0') as target,
  COALESCE(ko.frequency, 'monthly') as frequency,
  ko.calculation_method,
  ko.responsible
FROM kpis_orsega ko
LEFT JOIN areas a ON LOWER(a.name) = LOWER(ko.area) AND a.company_id = 2
WHERE NOT EXISTS (
  SELECT 1 FROM kpis k 
  WHERE LOWER(k.name) = LOWER(ko.kpi_name) 
  AND k.company_id = 2
)
ON CONFLICT DO NOTHING;

-- Paso 5: Guardar mapeos para kpis_orsega
INSERT INTO kpi_migration_map (old_id, new_id, company_id, old_table)
SELECT ko.id, k.id, 2, 'kpis_orsega'
FROM kpis_orsega ko
JOIN kpis k ON LOWER(k.name) = LOWER(ko.kpi_name) AND k.company_id = 2
ON CONFLICT DO NOTHING;

-- Paso 6: Verificar resultados
SELECT 
  old_table,
  COUNT(*) as mapped_count,
  company_id
FROM kpi_migration_map
GROUP BY old_table, company_id
ORDER BY company_id, old_table;

-- VERIFICAR: Los conteos deben coincidir con los de las tablas viejas
-- Comparar con:
-- SELECT COUNT(*) FROM kpis_dura;
-- SELECT COUNT(*) FROM kpis_orsega;

-- Si todo está bien, hacer COMMIT
-- COMMIT;

-- Si hay problemas, hacer ROLLBACK
-- ROLLBACK;

