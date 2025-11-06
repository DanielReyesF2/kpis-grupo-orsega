-- ============================================================
-- SCRIPT DE MIGRACIÓN: kpi_values_dura + kpi_values_orsega -> kpi_values
-- ============================================================
-- IMPORTANTE: Ejecutar DESPUÉS de 02_migrate-kpis.sql

BEGIN;

-- Función helper para convertir MES AÑO a formato estándar
CREATE OR REPLACE FUNCTION format_month_year(month_text TEXT, year_num INTEGER)
RETURNS TEXT AS $$
DECLARE
  month_map JSONB;
  month_upper TEXT;
BEGIN
  month_map := '{
    "ENERO": "Enero", "FEBRERO": "Febrero", "MARZO": "Marzo", "ABRIL": "Abril",
    "MAYO": "Mayo", "JUNIO": "Junio", "JULIO": "Julio", "AGOSTO": "Agosto",
    "SEPTIEMBRE": "Septiembre", "OCTUBRE": "Octubre", "NOVIEMBRE": "Noviembre",
    "DICIEMBRE": "Diciembre",
    "enero": "Enero", "febrero": "Febrero", "marzo": "Marzo", "abril": "Abril",
    "mayo": "Mayo", "junio": "Junio", "julio": "Julio", "agosto": "Agosto",
    "septiembre": "Septiembre", "octubre": "Octubre", "noviembre": "Noviembre",
    "diciembre": "Diciembre"
  }'::jsonb;
  
  month_upper := UPPER(TRIM(month_text));
  
  -- Intentar mapear o usar el valor original si no se encuentra
  RETURN COALESCE(month_map->>month_upper, month_text) || ' ' || year_num::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Paso 1: Migrar kpi_values_dura -> kpi_values
-- Inserción en batch para mejor performance
DO $$
DECLARE
  insert_count INTEGER := 0;
BEGIN
  INSERT INTO kpi_values (kpi_id, value, period, date, compliance_percentage, status, comments, user_id)
  SELECT 
    m.new_id as kpi_id,
    v.value::TEXT as value,
    format_month_year(v.month, v.year) as period,
    v.created_at as date,
    NULL as compliance_percentage,
    NULL as status,
    NULL as comments,
    NULL as user_id -- Solo datos a nivel empresa
  FROM kpi_values_dura v
  JOIN kpi_migration_map m ON m.old_id = v.kpi_id AND m.old_table = 'kpis_dura' AND m.company_id = 1
  WHERE NOT EXISTS (
    SELECT 1 FROM kpi_values kv
    WHERE kv.kpi_id = m.new_id
    AND kv.period = format_month_year(v.month, v.year)
    AND kv.user_id IS NULL
  );
  
  GET DIAGNOSTICS insert_count = ROW_COUNT;
  RAISE NOTICE 'Migrados % registros de kpi_values_dura', insert_count;
END $$;

-- Paso 2: Migrar kpi_values_orsega -> kpi_values
DO $$
DECLARE
  insert_count INTEGER := 0;
BEGIN
  INSERT INTO kpi_values (kpi_id, value, period, date, compliance_percentage, status, comments, user_id)
  SELECT 
    m.new_id as kpi_id,
    v.value::TEXT as value,
    format_month_year(v.month, v.year) as period,
    v.created_at as date,
    NULL as compliance_percentage,
    NULL as status,
    NULL as comments,
    NULL as user_id -- Solo datos a nivel empresa
  FROM kpi_values_orsega v
  JOIN kpi_migration_map m ON m.old_id = v.kpi_id AND m.old_table = 'kpis_orsega' AND m.company_id = 2
  WHERE NOT EXISTS (
    SELECT 1 FROM kpi_values kv
    WHERE kv.kpi_id = m.new_id
    AND kv.period = format_month_year(v.month, v.year)
    AND kv.user_id IS NULL
  );
  
  GET DIAGNOSTICS insert_count = ROW_COUNT;
  RAISE NOTICE 'Migrados % registros de kpi_values_orsega', insert_count;
END $$;

-- Paso 3: Verificar resultados
SELECT 
  k.company_id,
  COUNT(kv.id) as migrated_values_count
FROM kpi_values kv
JOIN kpis k ON k.id = kv.kpi_id
WHERE kv.user_id IS NULL
GROUP BY k.company_id
ORDER BY k.company_id;

-- Comparar con conteos originales:
-- SELECT 'Dura' as company, COUNT(*) as original_count FROM kpi_values_dura
-- UNION ALL
-- SELECT 'Orsega' as company, COUNT(*) as original_count FROM kpi_values_orsega;

-- Mostrar una muestra de datos migrados
SELECT 
  k.company_id,
  k.name as kpi_name,
  kv.period,
  kv.value,
  kv.date
FROM kpi_values kv
JOIN kpis k ON k.id = kv.kpi_id
WHERE kv.user_id IS NULL
ORDER BY k.company_id, k.name, kv.date DESC
LIMIT 20;

-- Limpiar función helper
DROP FUNCTION IF EXISTS format_month_year(TEXT, INTEGER);

-- Si todo está bien, hacer COMMIT
-- COMMIT;

-- Si hay problemas, hacer ROLLBACK
-- ROLLBACK;

