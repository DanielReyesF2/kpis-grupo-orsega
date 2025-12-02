-- ============================================
-- VERIFICACIÓN COMPLETA: Tablas de Ventas
-- ============================================
-- Ejecuta esto después de la migración 0007 para verificar
-- que las tablas se crearon correctamente
-- ============================================

-- 1. Verificar todas las tablas en todos los schemas
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('sales_data', 'sales_uploads', 'sales_alerts')
ORDER BY table_schema, table_name;

-- 2. Verificar tablas en schema 'public' específicamente
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('sales_data', 'sales_uploads', 'sales_alerts')
ORDER BY table_name;

-- 3. Verificar si las tablas existen (método alternativo)
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_data'
) as sales_data_exists,
EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_uploads'
) as sales_uploads_exists,
EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_alerts'
) as sales_alerts_exists;

-- 4. Si las tablas existen, verificar sus columnas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('sales_data', 'sales_uploads', 'sales_alerts')
ORDER BY table_name, ordinal_position;

-- 5. Verificar índices creados
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('sales_data', 'sales_uploads', 'sales_alerts')
ORDER BY tablename, indexname;

