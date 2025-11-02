-- ============================================================
-- SCRIPT DE BACKUP: Renombrar tablas viejas antes de eliminarlas
-- ============================================================
-- IMPORTANTE: 
-- 1. Ejecutar SOLO después de verificar que todo funciona
-- 2. Ejecutar SOLO si todas las pruebas pasaron
-- 3. Estas tablas se pueden eliminar después de 1-2 semanas de monitoreo

BEGIN;

-- Crear timestamp para nombres de backup
DO $$
DECLARE
  backup_suffix TEXT;
BEGIN
  -- Formato: backup_20250115_143000
  backup_suffix := 'backup_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS');
  
  -- Renombrar tablas de Dura
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpis_dura') THEN
    EXECUTE format('ALTER TABLE kpis_dura RENAME TO kpis_dura_%s', backup_suffix);
    RAISE NOTICE 'Tabla kpis_dura renombrada a kpis_dura_%', backup_suffix;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpi_values_dura') THEN
    EXECUTE format('ALTER TABLE kpi_values_dura RENAME TO kpi_values_dura_%s', backup_suffix);
    RAISE NOTICE 'Tabla kpi_values_dura renombrada a kpi_values_dura_%', backup_suffix;
  END IF;
  
  -- Renombrar tablas de Orsega
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpis_orsega') THEN
    EXECUTE format('ALTER TABLE kpis_orsega RENAME TO kpis_orsega_%s', backup_suffix);
    RAISE NOTICE 'Tabla kpis_orsega renombrada a kpis_orsega_%', backup_suffix;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpi_values_orsega') THEN
    EXECUTE format('ALTER TABLE kpi_values_orsega RENAME TO kpi_values_orsega_%s', backup_suffix);
    RAISE NOTICE 'Tabla kpi_values_orsega renombrada a kpi_values_orsega_%', backup_suffix;
  END IF;
  
  RAISE NOTICE '✅ Backups creados con sufijo: %', backup_suffix;
END $$;

-- Listar tablas de backup creadas
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE tablename LIKE '%backup_%'
ORDER BY tablename;

-- Si todo está bien, hacer COMMIT
-- COMMIT;

-- Si hay problemas, hacer ROLLBACK
-- ROLLBACK;

