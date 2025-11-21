-- =====================================================
-- VERIFICAR ESTADO ACTUAL DE LA IMPLEMENTACIÓN
-- =====================================================

-- 1. Verificar columnas en tabla shipments
SELECT 
  'COLUMNAS EN SHIPMENTS' as verificacion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN ('transport_cost', 'in_route_at', 'delivered_at')
ORDER BY column_name;

-- 2. Verificar si los KPIs de Logística ya existen
SELECT 
  'KPIs DE LOGÍSTICA' as verificacion,
  id,
  name,
  description,
  goal,
  "companyId",
  CASE
    WHEN "companyId" = 1 THEN 'Dura International'
    WHEN "companyId" = 2 THEN 'Grupo Orsega'
    ELSE 'Otra'
  END as empresa,
  "userId",
  category,
  frequency
FROM "Kpi"
WHERE category = 'Logística'
AND "userId" = 7
ORDER BY "companyId", name;

-- 3. Contar KPIs de Logística
SELECT 
  'RESUMEN' as verificacion,
  COUNT(*) as total_kpis_logistica,
  COUNT(DISTINCT "companyId") as empresas_configuradas
FROM "Kpi"
WHERE category = 'Logística'
AND "userId" = 7;

-- 4. Verificar usuario Thalia
SELECT 
  'USUARIO THALIA' as verificacion,
  id,
  name,
  email
FROM "User"
WHERE id = 7;


