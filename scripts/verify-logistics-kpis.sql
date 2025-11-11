-- =====================================================
-- SCRIPT DE VERIFICACIÓN - KPIs de Logística
-- =====================================================
-- Este script verifica que todo esté correctamente implementado:
-- 1. Columnas en tabla shipments
-- 2. KPIs creados para Thalia (ID: 7)
-- 3. Estructura correcta
-- =====================================================

-- 1. VERIFICAR COLUMNAS EN TABLA SHIPMENTS
-- =====================================================
SELECT 
  'COLUMNAS EN SHIPMENTS' as verificacion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN ('transport_cost', 'in_route_at', 'delivered_at')
ORDER BY column_name;

-- 2. VERIFICAR KPIs CREADOS PARA THALIA (ID: 7)
-- =====================================================
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

-- 3. CONTAR KPIs POR EMPRESA
-- =====================================================
SELECT 
  'RESUMEN DE KPIs' as verificacion,
  "companyId",
  CASE
    WHEN "companyId" = 1 THEN 'Dura International'
    WHEN "companyId" = 2 THEN 'Grupo Orsega'
    ELSE 'Otra'
  END as empresa,
  COUNT(*) as total_kpis,
  STRING_AGG(name, ', ') as nombres_kpis
FROM "Kpi"
WHERE category = 'Logística'
AND "userId" = 7
GROUP BY "companyId"
ORDER BY "companyId";

-- 4. VERIFICAR SHIPMENTS CON DATOS DE LOGÍSTICA
-- =====================================================
SELECT 
  'SHIPMENTS CON DATOS' as verificacion,
  COUNT(*) as total_shipments,
  COUNT(transport_cost) as shipments_con_costo,
  COUNT(in_route_at) as shipments_en_ruta,
  COUNT(delivered_at) as shipments_entregados,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as shipments_estado_entregado
FROM shipments;

-- 5. VERIFICAR VALORES DE KPIs ACTUALES
-- =====================================================
SELECT 
  'VALORES DE KPIs' as verificacion,
  k.name as kpi_name,
  k."companyId",
  kv.value,
  kv."compliancePercentage",
  kv.date as fecha_valor
FROM "Kpi" k
LEFT JOIN "KpiValue" kv ON k.id = kv."kpiId"
WHERE k.category = 'Logística'
AND k."userId" = 7
ORDER BY k."companyId", k.name, kv.date DESC;

-- 6. VERIFICAR USUARIO THALIA
-- =====================================================
SELECT 
  'USUARIO THALIA' as verificacion,
  id,
  name,
  email,
  "companyId"
FROM "User"
WHERE id = 7;

-- 7. RESUMEN FINAL
-- =====================================================
SELECT 
  '✅ VERIFICACIÓN COMPLETA' as resultado,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'shipments' 
   AND column_name IN ('transport_cost', 'in_route_at', 'delivered_at')) as columnas_agregadas,
  (SELECT COUNT(*) FROM "Kpi" 
   WHERE category = 'Logística' AND "userId" = 7) as kpis_creados,
  (SELECT COUNT(DISTINCT "companyId") FROM "Kpi" 
   WHERE category = 'Logística' AND "userId" = 7) as empresas_configuradas;


