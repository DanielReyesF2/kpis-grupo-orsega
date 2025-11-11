-- =====================================================
-- VERIFICAR Y CREAR CONSTRAINTS UNIQUE SI FALTAN
-- =====================================================

-- 1. VERIFICAR CONSTRAINTS EXISTENTES EN kpi_values_dura
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'kpi_values_dura'::regclass
AND contype = 'u'
ORDER BY conname;

-- 2. VERIFICAR CONSTRAINTS EXISTENTES EN kpi_values_orsega
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'kpi_values_orsega'::regclass
AND contype = 'u'
ORDER BY conname;

-- 3. CREAR CONSTRAINT UNIQUE SI NO EXISTE (kpi_values_dura)
-- Descomenta las siguientes líneas si la constraint no existe:
-- ALTER TABLE kpi_values_dura
-- ADD CONSTRAINT kpi_values_dura_unique_period 
-- UNIQUE (kpi_id, month, year);

-- 4. CREAR CONSTRAINT UNIQUE SI NO EXISTE (kpi_values_orsega)
-- Descomenta las siguientes líneas si la constraint no existe:
-- ALTER TABLE kpi_values_orsega
-- ADD CONSTRAINT kpi_values_orsega_unique_period 
-- UNIQUE (kpi_id, month, year);

-- 5. VERIFICAR KPIs DE LOGÍSTICA EN ORSEGA
SELECT 
  id,
  kpi_name,
  description,
  goal,
  unit,
  frequency,
  responsible
FROM kpis_orsega
WHERE area = 'Logística'
ORDER BY kpi_name;


